import crypto from 'crypto'
import {
    IPaymentStrategy,
    PaymentInitParams,
    PaymentInitResult,
    PaymentVerifyResult,
    WebhookEvent,
    TransferParams,
    TransferResult,
} from './IPaymentStrategy'

const NOTCHPAY_BASE_URL = 'https://api.notchpay.co'

/**
 * NotchPay payment strategy.
 * Requires env vars: NOTCHPAY_PUBLIC_KEY, NOTCHPAY_SECRET_KEY, NOTCHPAY_HASH
 *
 * Docs: https://notchpay.co/docs
 */
export class NotchPayStrategy implements IPaymentStrategy {
    readonly providerName = 'notchpay'

    private get publicKey(): string {
        const key = process.env.NOTCHPAY_PUBLIC_KEY
        if (!key) throw new Error('NOTCHPAY_PUBLIC_KEY environment variable is not defined')
        return key
    }

    private get secretKey(): string {
        const key = process.env.NOTCHPAY_SECRET_KEY
        if (!key) throw new Error('NOTCHPAY_SECRET_KEY environment variable is not defined')
        return key
    }

    private get hash(): string {
        const h = process.env.NOTCHPAY_HASH
        if (!h) throw new Error('NOTCHPAY_HASH environment variable is not defined')
        return h
    }

    async initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
        const body = {
            amount: params.amount,
            currency: params.currency,
            email: params.email,
            description: params.description,
            reference: params.reference,
            callback: params.callbackUrl,
            metadata: params.metadata ?? {},
        }

        const response = await fetch(`${NOTCHPAY_BASE_URL}/payments/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: this.publicKey,
            },
            body: JSON.stringify(body),
        })

        const data = await response.json() as {
            status?: string
            message?: string
            authorization_url?: string
            transaction?: { reference: string }
        }

        if (!response.ok || data.status !== 'Accepted') {
            throw new Error(
                `NotchPay initialization failed: ${data.message ?? response.statusText}`
            )
        }

        if (!data.authorization_url) {
            throw new Error('NotchPay did not return an authorization_url')
        }

        return {
            paymentUrl: data.authorization_url,
            reference: data.transaction?.reference ?? params.reference,
            provider: this.providerName,
        }
    }

    async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
        const response = await fetch(`${NOTCHPAY_BASE_URL}/payments/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: this.publicKey,
            },
        })

        const data = await response.json() as {
            status?: string
            message?: string
            transaction?: {
                reference: string
                status: string
                amount: number
                currency: string
                paid_at?: string
            }
        }

        if (!response.ok || !data.transaction) {
            throw new Error(
                `NotchPay verification failed: ${data.message ?? response.statusText}`
            )
        }

        const t = data.transaction

        return {
            reference: t.reference,
            status: this.mapStatus(t.status),
            amount: t.amount,
            currency: t.currency,
            paidAt: t.paid_at ? new Date(t.paid_at) : undefined,
        }
    }

    handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
        const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
        const expected = crypto
            .createHmac('sha256', this.hash)
            .update(raw)
            .digest('hex')

        if (expected !== signature) {
            throw new Error('Invalid NotchPay webhook signature')
        }

        const parsed = (typeof payload === 'string' ? JSON.parse(payload) : payload) as {
            transaction?: {
                reference: string
                status: string
                amount: number
                currency: string
                metadata?: Record<string, string>
            }
        }

        if (!parsed.transaction) {
            throw new Error('NotchPay webhook payload missing transaction object')
        }

        const t = parsed.transaction

        return Promise.resolve({
            reference: t.reference,
            status: this.mapStatus(t.status),
            amount: t.amount,
            currency: t.currency,
            metadata: t.metadata,
        })
    }

    /**
     * Initie un virement Mobile Money vers un vendeur via l'API NotchPay Transfers.
     * Docs: https://developer.notchpay.co/transfers
     */
    async transfer(params: TransferParams): Promise<TransferResult> {
        const body = {
            amount: params.amount,
            currency: params.currency,
            phone: params.phone,
            channel: params.channel,
            reference: params.reference,
            description: params.description,
            beneficiary: { name: params.recipientName, phone: params.phone },
        }

        const response = await fetch(`${NOTCHPAY_BASE_URL}/transfers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: this.secretKey,
            },
            body: JSON.stringify(body),
        })

        const data = await response.json() as {
            status?: string
            message?: string
            transfer?: {
                id: string
                reference: string
                status: string
            }
        }

        if (!response.ok || !data.transfer) {
            throw new Error(
                `NotchPay transfer failed: ${data.message ?? response.statusText}`
            )
        }

        const t = data.transfer
        return {
            transferId: t.id,
            reference: t.reference,
            status: this.mapTransferStatus(t.status),
        }
    }

    private mapStatus(status: string): 'completed' | 'pending' | 'failed' | 'cancelled' {
        const s = status.toLowerCase()
        if (s === 'complete' || s === 'completed') return 'completed'
        if (s === 'failed' || s === 'error') return 'failed'
        if (s === 'cancelled' || s === 'canceled') return 'cancelled'
        return 'pending'
    }

    private mapTransferStatus(status: string): 'queued' | 'processing' | 'completed' | 'failed' {
        const s = status.toLowerCase()
        if (s === 'complete' || s === 'completed' || s === 'success') return 'completed'
        if (s === 'failed' || s === 'error') return 'failed'
        if (s === 'processing') return 'processing'
        return 'queued'
    }
}

export const notchPayStrategy = new NotchPayStrategy()
