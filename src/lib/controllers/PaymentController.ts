import { NextResponse } from 'next/server'
import { PaymentService } from '@/lib/services/PaymentService'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { TransactionType, TransactionStatus } from '@/models/enums'

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
     * Initiate a payment for any product type.
     */
    static async initiatePayment(req: Request, session: AuthSession) {
        const body = await req.json() as {
            type: TransactionType
            productId: string
            productModel: 'Book' | 'Plan' | 'Course'
            currency: string
            callbackUrl: string
            discountPercent?: number
            interval?: string
        }

        if (!body.type || !body.productId || !body.productModel || !body.currency || !body.callbackUrl) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields: type, productId, productModel, currency, callbackUrl' },
                { status: 400 }
            )
        }

        const result = await PaymentService.initiatePayment({
            userId: session.user.id,
            userEmail: session.user.email,
            type: body.type,
            productId: body.productId,
            productModel: body.productModel,
            paymentCurrency: body.currency.toUpperCase(),
            callbackUrl: body.callbackUrl,
            discountPercent: body.discountPercent,
            interval: body.interval as any,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    /**
     * GET /api/payments/:reference
     * Get transaction status by reference.
     */
    static async getTransactionStatus(reference: string, session: AuthSession) {
        const transaction = await PaymentService.getTransactionByReference(reference)

        if (!transaction) {
            return NextResponse.json(
                { success: false, message: 'Transaction not found' },
                { status: 404 }
            )
        }

        // Only allow user to see their own transactions (unless admin)
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
        const status = await PaymentService.verifyPayment(reference, providerRef)

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

        const result = await PaymentService.getUserTransactions(session.user.id, page, limit)

        return NextResponse.json({
            success: true,
            data: result,
        })
    }

    /**
     * POST /api/payments/webhook/notchpay
     * Webhook générique unifié NotchPay — unique point d'entrée.
     * Traite tous types de paiements :
     *  - Achats de livres (authentifiés + guest)
     *  - Abonnements
     *  - Toute autre Transaction future (cours, recharges…)
     */
    static async handleNotchPayWebhook(req: Request) {
        const rawBody = await req.text()
        // NotchPay doc header: x-notch-signature.
        // Keep x-notchpay-signature as backward-compatible fallback.
        const signature =
            req.headers.get('x-notch-signature') ??
            req.headers.get('x-notchpay-signature') ??
            ''

        /**
         * BookPurchaseService.handleWebhook :
         *  - met à jour la table legacy BookPurchase
         *  - met à jour Transaction via PaymentService.handleWebhook
         *  - gère les achats guest (GuestPurchase + email de téléchargement)
         * Couvre déjà tous les cas liés aux livres et aux transactions génériques.
         */
        await BookPurchaseService.handleWebhook(rawBody, signature)

        // Activation d'abonnement si c'était un SUBSCRIPTION
        try {
            const payload = JSON.parse(rawBody) as { transaction?: { reference?: string; status?: string } }
            if (payload.transaction?.reference && payload.transaction?.status === 'complete') {
                const transaction = await PaymentService.getTransactionByReference(payload.transaction.reference)
                if (transaction?.type === TransactionType.SUBSCRIPTION) {
                    await SubscriptionService.activateSubscription(payload.transaction.reference)
                }
            }
        } catch (error) {
            console.error('[PaymentController] Error activating subscription:', error)
        }

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

        const { transactionRepository } = await import('@/lib/repositories/TransactionRepository')

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

        const stats = await PaymentService.getStats({
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
        })

        return NextResponse.json({
            success: true,
            data: stats,
        })
    }
}
