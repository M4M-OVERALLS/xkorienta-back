import { randomUUID } from 'crypto'
import { IBookPurchase } from '@/models/BookPurchase'
import { BookPurchaseStatus, BookStatus } from '@/models/enums'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookPurchaseRepository } from '@/lib/repositories/BookPurchaseRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { BookConfigService } from './BookConfigService'
import { BookService } from './BookService'
import { PaymentStrategyFactory } from '@/lib/strategies/payment/PaymentStrategyFactory'
import { PaymentInitResult } from '@/lib/strategies/payment/IPaymentStrategy'
import mongoose from 'mongoose'

export interface InitiatePurchaseInput {
    bookId: string
    userId: string
    userEmail: string
    userLevel: number
    callbackUrl: string
}

export interface PurchaseResult {
    paymentUrl: string
    reference: string
    provider: string
    originalPrice: number
    discountPercent: number
    finalAmount: number
    currency: string
}

export class BookPurchaseService {
    /**
     * Initiates a book purchase. Calculates discount based on user level,
     * creates a PENDING purchase record, and returns a payment URL.
     */
    static async initiatePurchase(input: InitiatePurchaseInput): Promise<PurchaseResult> {
        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== BookStatus.APPROVED) throw new Error('Book is not available for purchase')
        if (book.price === 0) throw new Error('This book is free, no purchase needed')

        // Prevent duplicate purchases
        const existing = await bookPurchaseRepository.findByUserAndBook(input.userId, input.bookId)
        if (existing && existing.status === BookPurchaseStatus.COMPLETED) {
            throw new Error('You have already purchased this book')
        }

        const config = await bookConfigRepository.getOrCreate()
        const discountPercent = await BookConfigService.getDiscountForLevel(input.userLevel)
        const { finalAmount, teacherAmount, platformCommission } =
            BookConfigService.calculatePricing(book.price, discountPercent, config.commissionRate)

        const reference = `BOOK-${input.bookId.slice(-6)}-${randomUUID().slice(0, 8).toUpperCase()}`

        const paymentStrategy = PaymentStrategyFactory.create(config.paymentProvider)
        let paymentResult: PaymentInitResult

        try {
            paymentResult = await paymentStrategy.initiatePayment({
                amount: finalAmount,
                currency: book.currency,
                reference,
                email: input.userEmail,
                description: `Achat livre: ${book.title}`,
                callbackUrl: input.callbackUrl,
                metadata: {
                    bookId: input.bookId,
                    userId: input.userId,
                },
            })
        } catch (err) {
            throw new Error(`Payment initialization failed: ${(err as Error).message}`)
        }

        // If a previous pending purchase exists, update it; otherwise create
        if (existing && existing.status === BookPurchaseStatus.PENDING) {
            await bookPurchaseRepository.updateStatusByReference(
                existing.paymentReference,
                BookPurchaseStatus.FAILED
            )
        }

        await bookPurchaseRepository.create({
            bookId: new mongoose.Types.ObjectId(input.bookId),
            userId: new mongoose.Types.ObjectId(input.userId),
            originalPrice: book.price,
            discountPercent,
            finalAmount,
            currency: book.currency,
            paymentReference: reference,
            paymentProvider: config.paymentProvider,
            status: BookPurchaseStatus.PENDING,
            teacherAmount,
            platformCommission,
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            reference,
            provider: config.paymentProvider,
            originalPrice: book.price,
            discountPercent,
            finalAmount,
            currency: book.currency,
        }
    }

    /**
     * Handles a payment webhook from the provider.
     * Updates the purchase status and increments the book's purchase count.
     */
    static async handleWebhook(rawPayload: unknown, signature: string): Promise<void> {
        const config = await bookConfigRepository.getOrCreate()
        const paymentStrategy = PaymentStrategyFactory.create(config.paymentProvider)

        const event = await paymentStrategy.handleWebhook(rawPayload, signature)

        const purchase = await bookPurchaseRepository.findByReference(event.reference)
        if (!purchase) return // Unknown reference — ignore

        if (purchase.status === BookPurchaseStatus.COMPLETED) return // Already processed

        const newStatus =
            event.status === 'completed' ? BookPurchaseStatus.COMPLETED :
            event.status === 'failed'    ? BookPurchaseStatus.FAILED :
            event.status === 'cancelled' ? BookPurchaseStatus.FAILED :
            BookPurchaseStatus.PENDING

        await bookPurchaseRepository.updateStatusByReference(event.reference, newStatus)

        if (newStatus === BookPurchaseStatus.COMPLETED) {
            await bookRepository.incrementPurchaseCount(purchase.bookId.toString())
        }
    }

    /**
     * Checks if a user has access to a book (free or purchased).
     */
    static async hasAccess(userId: string, bookId: string): Promise<boolean> {
        const book = await bookRepository.findById(bookId)
        if (!book) return false
        if (book.status !== BookStatus.APPROVED) return false
        if (book.price === 0) return true

        return bookPurchaseRepository.hasAccess(userId, bookId)
    }

    /**
     * Returns the list of books purchased by a user.
     */
    static async getPurchasedBooks(userId: string, page = 1, limit = 20): Promise<IBookPurchase[]> {
        return bookPurchaseRepository.findByUser(userId, page, limit)
    }
}
