import { PaymentSDK } from '@xkorienta/payment-sdk'
import { MongoStorageAdapter } from '@/lib/adapters/MongoStorageAdapter'
import { PusherNotificationAdapter } from '@/lib/adapters/PusherNotificationAdapter'
import { NodemailerAdapter } from '@/lib/adapters/NodemailerAdapter'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookPurchaseRepository } from '@/lib/repositories/BookPurchaseRepository'
import { mediaPurchaseRepository } from '@/lib/repositories/MediaPurchaseRepository'
import { WalletService } from '@/lib/services/WalletService'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { BookPurchaseStatus, MediaPurchaseStatus, Currency } from '@/models/enums'

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

/** Credit the seller's wallet after a sale with a commission split. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.sellerId) {
        await WalletService.creditSeller(e.sellerId, e.sellerAmount, e.currency as Currency)
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
    const buyer = tx.userId as unknown as { name?: string; email?: string }
    const buyerName = buyer?.name ?? 'Client'
    const buyerEmail = buyer?.email
    await InvoiceService.generateForTransaction(tx, buyerName, buyerEmail)
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
