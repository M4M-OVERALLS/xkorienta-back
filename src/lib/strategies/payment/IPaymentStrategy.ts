/**
 * Interface contrat pour les stratégies de paiement.
 * Permet de changer de processeur (NotchPay, Stripe…) sans modifier les services.
 */

export interface PaymentInitParams {
    amount: number
    currency: string
    reference: string
    email: string
    description: string
    callbackUrl: string
    metadata?: Record<string, string>
}

export interface PaymentInitResult {
    paymentUrl: string
    reference: string
    provider: string
}

export interface PaymentVerifyResult {
    reference: string
    status: 'completed' | 'pending' | 'failed' | 'cancelled'
    amount: number
    currency: string
    paidAt?: Date
}

export interface WebhookEvent {
    reference: string
    status: 'completed' | 'pending' | 'failed' | 'cancelled'
    amount: number
    currency: string
    metadata?: Record<string, string>
}

export interface IPaymentStrategy {
    readonly providerName: string

    /**
     * Initialise a payment and returns a URL to redirect the user.
     */
    initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult>

    /**
     * Verifies the status of a payment by its reference.
     */
    verifyPayment(reference: string): Promise<PaymentVerifyResult>

    /**
     * Parses and validates an incoming webhook payload.
     * Throws if the signature is invalid.
     */
    handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent>
}
