import * as Sentry from '@sentry/nextjs'
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
import { BookPurchaseStatus, MediaPurchaseStatus, ApplicationStatus, PaymentStatus, Currency, MobileMoneyProvider } from '@/models/enums'
import SchoolApplication from '@/models/SchoolApplication'
import InscriptionForm from '@/models/InscriptionForm'
import { InscriptionEmailService } from '@/lib/services/InscriptionEmailService'

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
    if (e.type !== 'SUBSCRIPTION') return
    try {
        await SubscriptionService.activateSubscription(e.reference)
    } catch (err) {
        Sentry.captureException(err, { extra: { ref: e.reference, userId: e.userId, productId: e.productId } })
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

/** Update SchoolApplication status to PAID after inscription payment. */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type !== 'SCHOOL_INSCRIPTION') return
    try {
        const app = await SchoolApplication.findOne({ paymentRef: e.reference })
        if (!app) return
        app.appStatus = ApplicationStatus.PAID
        app.paymentStatus = PaymentStatus.PAID
        app.paidAt = new Date()
        await app.save()
    } catch (err) {
        Sentry.captureException(err, { extra: { ref: e.reference, type: 'SCHOOL_INSCRIPTION' } })
    }
})

/** Send inscription-specific emails after payment (confirmation + admin notification). */
paymentSDK.events.on('payment.completed', async (e) => {
    if (e.type !== 'SCHOOL_INSCRIPTION') return
    try {
        const app = await SchoolApplication.findOne({ paymentRef: e.reference })
            .populate('userId', 'name email')
            .populate('schoolId', 'name contactInfo')
            .lean()
        if (!app) return

        const form = await InscriptionForm.findById(app.inscriptionFormId)
            .populate('createdBy', 'email name')
            .lean()
        if (!form) return

        const studentName = (app.userId as unknown as { name?: string })?.name
            ?? (app.candidateData as Record<string, unknown>)?.nom as string
            ?? 'Candidat'
        const studentEmail = (app.userId as unknown as { email?: string })?.email ?? app.guestEmail
        const schoolName = (app.schoolId as unknown as { name?: string })?.name ?? 'Etablissement'
        const adminEmail = (form.createdBy as unknown as { email?: string })?.email
        const commissionRate = form.commissionRate ?? 5
        const netAmount = Math.round(form.price * (1 - commissionRate / 100))

        // Email confirmation a l'etudiant
        if (studentEmail) {
            await InscriptionEmailService.sendApplicationConfirmation({
                studentEmail,
                studentName,
                schoolName,
                formTitle: form.title,
                amount: form.price,
                currency: 'FCFA',
            })
        }

        // Notification a l'admin ecole
        if (adminEmail) {
            await InscriptionEmailService.notifySchoolAdmin({
                adminEmail,
                studentName,
                schoolName,
                formTitle: form.title,
                amount: form.price,
                netAmount,
                currency: 'FCFA',
            })
        }
    } catch (err) {
        // Non-bloquant : on log mais on ne throw pas
        Sentry.captureException(err, { extra: { ref: e.reference, type: 'SCHOOL_INSCRIPTION_EMAIL' } })
    }
})
