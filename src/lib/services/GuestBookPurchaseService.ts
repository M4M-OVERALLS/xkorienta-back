import { randomBytes, randomUUID } from 'crypto'
import mongoose from 'mongoose'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'
import { PaymentStrategyFactory } from '@/lib/strategies/payment/PaymentStrategyFactory'
import { BookStatus } from '@/models/enums'
import { IGuestPurchase } from '@/models/GuestPurchase'
import { sendEmail } from '@/lib/mail'

const APP_BASE = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
).replace(/\/$/, '')

const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL ||
    APP_BASE
).replace(/\/$/, '')

export interface GuestPurchaseResult {
    paymentUrl: string
    reference: string
    finalAmount: number
    currency: string
}

export class GuestBookPurchaseService {
    /**
     * Initiate a guest (unauthenticated) book purchase.
     * Does not require a userId — uses only an email address.
     * A download link will be sent to this email after payment confirmation.
     */
    static async initiateGuestPurchase(
        bookId: string,
        email: string,
        callbackUrl: string
    ): Promise<GuestPurchaseResult> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== BookStatus.APPROVED) throw new Error('Book not available for purchase')
        if (book.price === 0) throw new Error('This book is free, no purchase needed')

        // Prevent re-purchase if already completed for same email
        const existing = await guestPurchaseRepository.findCompletedByEmailAndBook(email, bookId)
        if (existing) throw new Error('You have already purchased this book with this email')

        const reference = `GUEST-${bookId.slice(-6).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30)

        const config = await bookConfigRepository.getOrCreate()
        const strategy = PaymentStrategyFactory.create(config.paymentProvider)

        const result = await strategy.initiatePayment({
            amount: book.price,
            currency: book.currency,
            reference,
            email,
            description: `Achat livre : ${book.title}`,
            callbackUrl,
            metadata: {
                bookId,
                guestEmail: email,
                isGuest: 'true',
            },
        })

        await guestPurchaseRepository.create({
            bookId: new mongoose.Types.ObjectId(bookId),
            email: email.toLowerCase(),
            paymentReference: reference,
            paymentProvider: config.paymentProvider,
            status: 'PENDING',
            finalAmount: book.price,
            currency: book.currency,
            maxDownloads: 3,
            downloadCount: 0,
            expiresAt,
        })

        return {
            paymentUrl: result.paymentUrl,
            reference,
            finalAmount: book.price,
            currency: book.currency,
        }
    }

    /**
     * Called by the webhook handler when a guest purchase is COMPLETED.
     * Generates a secure download token and sends it by email.
     */
    static async handleGuestPurchaseCompleted(guestPurchase: IGuestPurchase): Promise<void> {
        const token = randomBytes(32).toString('hex')
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + 7) // token valid 7 days

        await guestPurchaseRepository.setDownloadToken(guestPurchase._id.toString(), token, expiry)
        await bookRepository.incrementPurchaseCount(guestPurchase.bookId.toString())

        const book = await bookRepository.findById(guestPurchase.bookId.toString())
        const sent = await GuestBookPurchaseService.sendDownloadEmail(
            guestPurchase.email,
            book?.title ?? 'votre livre',
            token,
            guestPurchase.finalAmount,
            guestPurchase.currency
        )
        if (!sent) {
            console.error(
                `[GuestBookPurchaseService] Email not sent for reference ${guestPurchase.paymentReference} to ${guestPurchase.email}`
            )
        }
    }

    /**
     * Validates a guest download token. Returns bookId if valid, null otherwise.
     */
    static async validateDownloadToken(
        token: string
    ): Promise<{ bookId: string; guestPurchaseId: string } | null> {
        const purchase = await guestPurchaseRepository.findByToken(token)
        if (!purchase) return null
        if (purchase.downloadTokenExpiry && purchase.downloadTokenExpiry < new Date()) return null
        if (purchase.downloadCount >= purchase.maxDownloads) return null
        return {
            bookId: purchase.bookId.toString(),
            guestPurchaseId: purchase._id.toString(),
        }
    }

    static async incrementDownload(guestPurchaseId: string): Promise<void> {
        await guestPurchaseRepository.incrementDownloadCount(guestPurchaseId)
    }

    /**
     * Sends the download email to the guest buyer.
     */
    private static async sendDownloadEmail(
        email: string,
        bookTitle: string,
        token: string,
        amount: number,
        currency: string
    ): Promise<boolean> {
        // Some deployments expose backend under a path prefix
        // (e.g. /xkorienta/backend). Build the download URL from API base.
        const guestDownloadPath = API_BASE.endsWith('/api')
            ? '/books/guest-download'
            : '/api/books/guest-download'
        const downloadUrl = `${API_BASE}${guestDownloadPath}?token=${token}`
        const formattedAmount = new Intl.NumberFormat('fr-FR').format(amount)
        const today = new Date().toLocaleDateString('fr-FR')

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre téléchargement — ${bookTitle}</title>
</head>
<body style="font-family:'Segoe UI',Roboto,sans-serif;background:#F3F4F6;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#114D5A 0%,#1a7a8f 100%);padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">✅ Paiement confirmé !</h1>
      <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">Votre livre est prêt à être téléchargé</p>
    </div>
    <div style="padding:40px 30px;color:#1F2937;font-size:15px;line-height:1.6;">
      <p>Bonjour,</p>
      <p>Votre achat de <strong>${bookTitle}</strong> a été confirmé avec succès.</p>
      <div style="background:#F0FDFA;border:1px solid #CCFBF1;border-radius:16px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0D9488;text-transform:uppercase;letter-spacing:0.5px;">Détails de l'achat</p>
        <p style="margin:4px 0;"><strong>📚 Livre :</strong> ${bookTitle}</p>
        <p style="margin:4px 0;"><strong>💰 Montant :</strong> ${formattedAmount} ${currency}</p>
        <p style="margin:4px 0;"><strong>📅 Date :</strong> ${today}</p>
      </div>
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#9A3412;">
          ⚠️ Ce lien est valable <strong>7 jours</strong> et utilisable <strong>3 fois maximum</strong>.
          Conservez cet email précieusement.
        </p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${downloadUrl}"
           style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#114D5A 0%,#1a7a8f 100%);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 12px rgba(17,77,90,0.3);">
          📥 Télécharger mon livre
        </a>
      </div>
      <p style="font-size:12px;color:#6B7280;text-align:center;word-break:break-all;">
        Lien direct : <a href="${downloadUrl}" style="color:#114D5A;">${downloadUrl}</a>
      </p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0;">
      <p style="font-size:13px;color:#6B7280;">
        Créez un compte pour accéder à plus de ressources et bénéficier jusqu'à
        <strong>30% de remise</strong> automatique selon votre niveau&nbsp;:
        <a href="${APP_BASE}/register" style="color:#114D5A;font-weight:600;">S'inscrire gratuitement →</a>
      </p>
    </div>
    <div style="background:#F8FAFC;padding:24px;text-align:center;border-top:1px solid #E2E8F0;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">© ${new Date().getFullYear()} Xkorienta. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`

        const result = await sendEmail({
            to: email,
            subject: `📚 Votre lien de téléchargement — ${bookTitle}`,
            html,
        })
        return result.success
    }
}
