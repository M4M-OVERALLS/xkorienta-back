import { NextResponse } from 'next/server'
import { paymentSDK } from '@/lib/payment'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { mediaRepository } from '@/lib/repositories/MediaRepository'
import { planRepository } from '@/lib/repositories/PlanRepository'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { TransactionType, TransactionStatus, BookStatus, MediaStatus, SubscriptionInterval } from '@/models/enums'
import { BookConfigService } from '@/lib/services/BookConfigService'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'

export interface AuthSession {
    user: {
        id: string
        email: string
        role: string
        name?: string
    }
}

export class PaymentController {
    /**
     * POST /api/payments/initiate
     * Initiate a payment for any product type. Resolves product details then
     * delegates to the payment SDK.
     */
    static async initiatePayment(req: Request, session: AuthSession) {
        const body = await req.json() as {
            type: TransactionType
            productId: string
            productModel: 'Book' | 'Plan' | 'Course' | 'Media'
            currency: string
            callbackUrl: string
            discountPercent?: number
            interval?: string
            idempotencyKey?: string
        }

        if (!body.type || !body.productId || !body.productModel || !body.currency || !body.callbackUrl) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields: type, productId, productModel, currency, callbackUrl' },
                { status: 400 }
            )
        }

        const { amount, originalCurrency, description, sellerId } =
            await PaymentController.resolveProduct(body.type, body.productId, body.currency, body.interval)

        const result = await paymentSDK.payments.initiatePayment({
            userId: session.user.id,
            userEmail: session.user.email,
            type: body.type,
            productId: body.productId,
            productType: body.productModel,
            amount,
            originalCurrency,
            paymentCurrency: body.currency.toUpperCase(),
            description,
            callbackUrl: body.callbackUrl,
            discountPercent: body.discountPercent,
            sellerId,
            idempotencyKey: body.idempotencyKey,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    /**
     * Resolve product details (price, currency, description, sellerId) for any product type.
     */
    private static async resolveProduct(
        type: TransactionType,
        productId: string,
        paymentCurrency: string,
        interval?: string
    ): Promise<{ amount: number; originalCurrency: string; description: string; sellerId?: string }> {
        switch (type) {
            case TransactionType.BOOK_PURCHASE: {
                const book = await bookRepository.findById(productId)
                if (!book) throw new Error('Book not found')
                if (book.status !== BookStatus.APPROVED) throw new Error('Book is not available for purchase')
                if (book.price === 0) throw new Error('This book is free, no purchase needed')
                const submittedById = book.submittedBy as unknown
                const sellerId = submittedById
                    ? typeof submittedById === 'object' && '_id' in (submittedById as object)
                        ? String((submittedById as { _id: unknown })._id)
                        : String(submittedById)
                    : undefined
                return { amount: book.price, originalCurrency: book.currency, description: `Achat livre: ${book.title}`, sellerId }
            }
            case TransactionType.MEDIA_PURCHASE: {
                const media = await mediaRepository.findById(productId)
                if (!media) throw new Error('Média introuvable')
                if (media.status !== MediaStatus.APPROVED) throw new Error('Ce média n\'est pas disponible à l\'achat')
                if (media.price === 0) throw new Error('Ce média est gratuit, aucun paiement nécessaire')
                const submittedById = media.submittedBy as unknown
                const sellerId = submittedById
                    ? typeof submittedById === 'object' && '_id' in (submittedById as object)
                        ? String((submittedById as { _id: unknown })._id)
                        : String(submittedById)
                    : undefined
                return { amount: media.price, originalCurrency: media.currency, description: `Achat média : ${media.title}`, sellerId }
            }
            case TransactionType.SUBSCRIPTION: {
                const plan = await planRepository.findById(productId)
                if (!plan) throw new Error('Plan not found')
                if (!plan.isActive) throw new Error('Plan is not active')
                if (plan.isFree) throw new Error('This plan is free, no payment needed')
                const subscriptionInterval = (interval ?? SubscriptionInterval.MONTHLY) as SubscriptionInterval
                const price = plan.prices.find(
                    (p) => p.currency === paymentCurrency && p.interval === subscriptionInterval
                ) ?? plan.prices.find((p) => p.interval === subscriptionInterval)
                if (!price) throw new Error(`No price found for currency ${paymentCurrency}`)
                return { amount: price.amount, originalCurrency: price.currency, description: `Abonnement ${plan.name} (${subscriptionInterval.toLowerCase()})` }
            }
            default:
                throw new Error(`Unsupported transaction type: ${type}`)
        }
    }

    /**
     * GET /api/payments/:reference
     * Get transaction status by reference.
     */
    static async getTransactionStatus(reference: string, session: AuthSession) {
        const transaction = await transactionRepository.findByReference(reference)

        if (!transaction) {
            return NextResponse.json(
                { success: false, message: 'Transaction not found' },
                { status: 404 }
            )
        }

        if (
            transaction.userId.toString() !== session.user.id &&
            !['DG_M4M', 'TECH_SUPPORT'].includes(session.user.role)
        ) {
            return NextResponse.json(
                { success: false, message: 'Forbidden' },
                { status: 403 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                reference: transaction.paymentReference,
                status: transaction.status,
                type: transaction.type,
                originalAmount: transaction.originalAmount,
                originalCurrency: transaction.originalCurrency,
                finalAmount: transaction.finalAmount,
                paymentCurrency: transaction.paymentCurrency,
                exchangeRate: transaction.exchangeRate,
                discountPercent: transaction.discountPercent,
                createdAt: transaction.createdAt,
                completedAt: transaction.completedAt,
            },
        })
    }

    /**
     * POST /api/payments/verify/:reference
     * Verify payment status with provider.
     */
    static async verifyPayment(
        reference: string,
        session: AuthSession,
        providerRef?: string | null
    ) {
        const status = await paymentSDK.payments.verifyPayment(reference, providerRef)

        return NextResponse.json({
            success: true,
            data: { reference, status },
        })
    }

    /**
     * GET /api/payments/history
     * Get user's transaction history.
     */
    static async getHistory(req: Request, session: AuthSession) {
        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get('page') ?? '1', 10)
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)

        const result = await paymentSDK.payments.getUserTransactions(session.user.id, page, limit)

        return NextResponse.json({
            success: true,
            data: result,
        })
    }

    /**
     * POST /api/payments/webhook/notchpay
     * Unified NotchPay webhook handler.
     * Delegates Transaction update + event emission to BookPurchaseService (via SDK).
     */
    static async handleNotchPayWebhook(req: Request) {
        const rawBody = await req.text()
        const signature =
            req.headers.get('x-notch-signature') ??
            req.headers.get('x-notchpay-signature') ??
            ''

        // BookPurchaseService.handleWebhook:
        //  - calls paymentSDK.payments.handleWebhook (Transaction + EventBus)
        //  - handles guest purchases
        await BookPurchaseService.handleWebhook(rawBody, signature)

        return NextResponse.json({ success: true })
    }

    /**
     * GET /api/admin/payments/transactions
     * Admin: Get all transactions.
     */
    static async adminGetTransactions(req: Request) {
        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get('page') ?? '1', 10)
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
        const status = url.searchParams.get('status') as TransactionStatus | null
        const type = url.searchParams.get('type') as TransactionType | null

        const result = await transactionRepository.findPaginated({
            status: status ?? undefined,
            type: type ?? undefined,
            page,
            limit,
        })

        return NextResponse.json({
            success: true,
            data: result,
        })
    }

    /**
     * GET /api/admin/payments/stats
     * Admin: Get payment statistics.
     */
    static async adminGetStats(req: Request) {
        const url = new URL(req.url)
        const fromDate = url.searchParams.get('fromDate')
        const toDate = url.searchParams.get('toDate')

        const stats = await transactionRepository.getStats({
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
        })

        return NextResponse.json({
            success: true,
            data: stats,
        })
    }
}
