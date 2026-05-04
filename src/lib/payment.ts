import { PaymentSDK } from '@xkorienta/payment-sdk'
import { MongoStorageAdapter } from '@/lib/adapters/MongoStorageAdapter'
import { PusherNotificationAdapter } from '@/lib/adapters/PusherNotificationAdapter'
import { NodemailerAdapter } from '@/lib/adapters/NodemailerAdapter'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookPurchaseRepository } from '@/lib/repositories/BookPurchaseRepository'
import { mediaPurchaseRepository } from '@/lib/repositories/MediaPurchaseRepository'
import { userRepository } from '@/lib/repositories/UserRepository'
import { WalletService } from '@/lib/services/WalletService'
import { PayoutService } from '@/lib/services/PayoutService'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { BookPurchaseStatus, MediaPurchaseStatus, Currency, MobileMoneyProvider } from '@/models/enums'

export const paymentSDK = new PaymentSDK({
    defaultProvider: 'notchpay',
    defaultCurrency: 'XAF',
    supportedCurrencies: ['XAF', 'EUR', 'USD'],
    commissionRate: 5,
    transactionTTLMinutes: 30,
    exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY,

    providers: {
        notchpay: {
            publicKey: process.env.NOTCHPAY_PUBLIC_KEY!,
            secretKey: process.env.NOTCHPAY_SECRET_KEY!,
            webhookHash: process.env.NOTCHPAY_HASH!,
        },
    },

    storage: new MongoStorageAdapter(),
    notification: new PusherNotificationAdapter(),
    email: new NodemailerAdapter(),
})

// ── EventBus hooks — one handler per responsibility ───────────────────────────

/** Increment book purchase count after a successful book sale. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type === 'BOOK_PURCHASE') {
        await bookRepository.incrementPurchaseCount(e.productId)
    }
})

/**
 * Credit the seller after a sale.
 * Option A — virement immédiat NotchPay si le vendeur a configuré son mobile money.
 * Fallback — crédit wallet interne si paymentInfo manquant.
 */
paymentSDK.events.on('payment.completed', async (e) => {
    if (!e.sellerId || e.sellerAmount <= 0) return

    try {
        const seller = await userRepository.findById(e.sellerId)

        if (seller?.paymentInfo?.mobileMoneyPhone) {
            // Option A — virement immédiat NotchPay
            await PayoutService.transferImmediately({
                sellerId:          e.sellerId,
                amount:            e.sellerAmount,
                currency:          e.currency as Currency,
                recipientPhone:    seller.paymentInfo.mobileMoneyPhone,
                recipientName:     seller.paymentInfo.mobileMoneyName || seller.name,
                recipientProvider: seller.paymentInfo.mobileMoneyProvider as MobileMoneyProvider,
                saleReference:     e.reference,
            })
        } else {
            // Fallback wallet — le vendeur n'a pas encore configuré son mobile money
            await WalletService.creditSeller(e.sellerId, e.sellerAmount, e.currency as Currency)
        }
    } catch (err) {
        console.error('[payment.completed] Seller credit error:', (err as Error).message)
    }
})

/** Activate the subscription plan after payment. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type === 'SUBSCRIPTION') {
        await SubscriptionService.activateSubscription(e.reference)
    }
})

/**
 * Generate buyer/seller invoices after payment.
 * We fetch the full ITransaction from the repository to provide the typed
 * document that InvoiceService.generateForTransaction() expects.
 */
paymentSDK.events.on('payment.completed', async (e) => {
    const tx = await transactionRepository.findByReference(e.reference)
    if (!tx) return
    await InvoiceService.generateForTransaction(tx)
})

/** Sync legacy BookPurchase table on book sale completion. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type === 'BOOK_PURCHASE') {
        await bookPurchaseRepository.updateStatusByReference(e.reference, BookPurchaseStatus.COMPLETED)
    }
})

/** Sync legacy MediaPurchase table on media sale completion. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type === 'MEDIA_PURCHASE') {
        await mediaPurchaseRepository.updateStatusByReference(e.reference, MediaPurchaseStatus.COMPLETED)
    }
})
