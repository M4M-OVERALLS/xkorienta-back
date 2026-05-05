import { IBookPurchase } from '@/models/BookPurchase'
import { BookPurchaseStatus, BookStatus, TransactionType } from '@/models/enums'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookPurchaseRepository } from '@/lib/repositories/BookPurchaseRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { BookConfigService } from './BookConfigService'
import { GuestBookPurchaseService } from './GuestBookPurchaseService'
import { paymentSDK } from '@/lib/payment'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'
import mongoose from 'mongoose'

export interface InitiatePurchaseInput {
    bookId: string
    userId: string
    userEmail: string
    userLevel: number
    callbackUrl: string
    paymentCurrency?: string
}

export interface PurchaseResult {
    paymentUrl: string
    reference: string
    provider: string
    originalPrice: number
    discountPercent: number
    finalAmount: number
    currency: string
    exchangeRate?: number
    convertedAmount?: number
}

export class BookPurchaseService {
    /**
     * Initiates a book purchase using the payment SDK.
     * Creates records in both BookPurchase (legacy) and Transaction (new) tables.
     * Supports multi-currency with exchange rate conversion.
     */
    static async initiatePurchase(input: InitiatePurchaseInput): Promise<PurchaseResult> {
        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== BookStatus.APPROVED) throw new Error('Book is not available for purchase')
        if (book.price === 0) throw new Error('This book is free, no purchase needed')

        // Prevent duplicate purchases - check both old and new tables
        const existingLegacy = await bookPurchaseRepository.findByUserAndBook(input.userId, input.bookId)
        if (existingLegacy && existingLegacy.status === BookPurchaseStatus.COMPLETED) {
            throw new Error('You have already purchased this book')
        }

        const existingNew = await transactionRepository.findByUserAndProduct(
            input.userId,
            input.bookId,
            TransactionType.BOOK_PURCHASE
        )
        if (existingNew) {
            throw new Error('You have already purchased this book')
        }

        const config = await bookConfigRepository.getOrCreate()
        const discountPercent = await BookConfigService.getDiscountForLevel(input.userLevel)

        // Get teacher ID from book (handle both populated and non-populated)
        let submittedBy: string | undefined
        const submittedById = book.submittedBy as unknown
        if (submittedById) {
            if (typeof submittedById === 'object' && '_id' in (submittedById as object)) {
                submittedBy = String((submittedById as { _id: unknown })._id)
            } else {
                submittedBy = String(submittedById)
            }
        }

        // Use payment SDK for payment initiation (handles currency conversion)
        const paymentCurrency = input.paymentCurrency ?? book.currency
        const paymentResult = await paymentSDK.payments.initiatePayment({
            userId: input.userId,
            userEmail: input.userEmail,
            type: TransactionType.BOOK_PURCHASE,
            productId: input.bookId,
            productType: 'Book',
            amount: book.price,
            originalCurrency: book.currency,
            paymentCurrency,
            description: `Achat livre: ${book.title}`,
            callbackUrl: input.callbackUrl,
            discountPercent,
            sellerId: submittedBy,
            metadata: {
                bookTitle: book.title,
            },
        })

        // Also create legacy BookPurchase record for backward compatibility
        const { teacherAmount, platformCommission } =
            BookConfigService.calculatePricing(book.price, discountPercent, config.commissionRate)

        // Mark any previous pending purchases as failed
        if (existingLegacy && existingLegacy.status === BookPurchaseStatus.PENDING) {
            await bookPurchaseRepository.updateStatusByReference(
                existingLegacy.paymentReference,
                BookPurchaseStatus.FAILED
            )
        }

        await bookPurchaseRepository.create({
            bookId: new mongoose.Types.ObjectId(input.bookId),
            userId: new mongoose.Types.ObjectId(input.userId),
            originalPrice: book.price,
            discountPercent,
            finalAmount: paymentResult.finalAmount,
            currency: paymentCurrency,
            paymentReference: paymentResult.reference,
            paymentProvider: paymentResult.provider,
            status: BookPurchaseStatus.PENDING,
            teacherAmount,
            platformCommission,
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            reference: paymentResult.reference,
            provider: paymentResult.provider,
            originalPrice: paymentResult.originalAmount,
            discountPercent: paymentResult.discountPercent,
            finalAmount: paymentResult.finalAmount,
            currency: paymentResult.paymentCurrency,
            exchangeRate: paymentResult.exchangeRate,
            convertedAmount: paymentResult.convertedAmount,
        }
    }

    /**
     * Handles a payment webhook from the provider.
     * - Delegates Transaction update + event emission to the payment SDK.
     * - The SDK's EventBus (payment.ts) handles legacy BookPurchase sync, wallet credit, invoices.
     * - Handles guest purchases separately (outside SDK scope).
     */
    static async handleWebhook(rawPayload: unknown, signature: string): Promise<void> {
        // Parse payload to extract reference and status for guest purchase handling
        let reference: string | undefined
        let providerStatus: string | undefined
        try {
            const parsed = typeof rawPayload === 'string'
                ? JSON.parse(rawPayload)
                : rawPayload as Record<string, unknown>
            const tx = parsed.transaction as Record<string, unknown> | undefined
            reference = tx?.reference as string | undefined
            providerStatus = tx?.status as string | undefined
        } catch {
            // Will fail gracefully below
        }

        // SDK handles Transaction update + emits payment.* events (EventBus in payment.ts)
        const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
        await paymentSDK.payments.handleWebhook('notchpay', payload, signature)

        // Handle guest purchases (no userId — download link sent by email)
        if (reference) {
            const guestPurchase = await guestPurchaseRepository.findByReference(reference)
            if (guestPurchase && guestPurchase.status !== 'COMPLETED') {
                const isCompleted = providerStatus === 'complete' || providerStatus === 'completed'
                const isFailed = providerStatus === 'failed' || providerStatus === 'cancelled'
                const guestStatus: 'COMPLETED' | 'FAILED' | 'PENDING' =
                    isCompleted ? 'COMPLETED' : isFailed ? 'FAILED' : 'PENDING'

                await guestPurchaseRepository.updateStatusByReference(reference, guestStatus)

                if (guestStatus === 'COMPLETED') {
                    await GuestBookPurchaseService.handleGuestPurchaseCompleted(guestPurchase)
                }
            }
        }
    }

    /**
     * Checks if a user has access to a book (free or purchased).
     * Checks both legacy BookPurchase and new Transaction tables.
     */
    static async hasAccess(userId: string, bookId: string): Promise<boolean> {
        const book = await bookRepository.findById(bookId)
        if (!book) return false
        if (book.status !== BookStatus.APPROVED) return false
        if (book.price === 0) return true

        // Check legacy table first
        const hasLegacyAccess = await bookPurchaseRepository.hasAccess(userId, bookId)
        if (hasLegacyAccess) return true

        // Check new Transaction table
        const transaction = await transactionRepository.findByUserAndProduct(
            userId,
            bookId,
            TransactionType.BOOK_PURCHASE
        )
        return !!transaction
    }

    /**
     * Returns the list of books purchased by a user.
     */
    static async getPurchasedBooks(userId: string, page = 1, limit = 20): Promise<IBookPurchase[]> {
        return bookPurchaseRepository.findByUser(userId, page, limit)
    }
}
