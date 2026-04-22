import { PaymentProvider } from '@/models/enums'
import { IPaymentStrategy } from './IPaymentStrategy'
import { notchPayStrategy } from './NotchPayStrategy'

/**
 * Factory that resolves the correct IPaymentStrategy from the provider name
 * stored in BookConfig. Swap processors without touching service logic.
 */
export class PaymentStrategyFactory {
    static create(provider: string): IPaymentStrategy {
        switch (provider as PaymentProvider) {
            case PaymentProvider.NOTCHPAY:
                return notchPayStrategy
            case PaymentProvider.STRIPE:
                throw new Error('Stripe strategy not yet implemented. Use notchpay for now.')
            default:
                return notchPayStrategy
        }
    }
}
