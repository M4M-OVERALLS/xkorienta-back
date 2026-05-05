import { IMediaPurchase } from '@/models/MediaPurchase'
import { MediaPurchaseStatus, MediaStatus, TransactionType } from '@/models/enums'
import { mediaRepository } from '@/lib/repositories/MediaRepository'
import { mediaPurchaseRepository } from '@/lib/repositories/MediaPurchaseRepository'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { BookConfigService } from './BookConfigService'
import { paymentSDK } from '@/lib/payment'
import mongoose from 'mongoose'

export interface InitiateMediaPurchaseInput {
    mediaId: string
    userId: string
    userEmail: string
    userLevel: number
    callbackUrl: string
    paymentCurrency?: string
}

export interface MediaPurchaseResult {
    paymentUrl: string
    reference: string
    provider: string
    originalPrice: number
    discountPercent: number
    finalAmount: number
    currency: string
    exchangeRate?: number
    convertedAmount?: number
}

export class MediaPurchaseService {
    /**
     * Initie l'achat d'un média.
     * Crée les entrées dans MediaPurchase et Transaction.
     */
    static async initiatePurchase(input: InitiateMediaPurchaseInput): Promise<MediaPurchaseResult> {
        const media = await mediaRepository.findById(input.mediaId)
        if (!media) throw new Error('Média introuvable')
        if (media.status !== MediaStatus.APPROVED) throw new Error('Ce média n\'est pas disponible à l\'achat')
        if (media.price === 0) throw new Error('Ce média est gratuit, aucun achat nécessaire')

        // Vérifie qu'il n'y a pas déjà un achat
        const existingLegacy = await mediaPurchaseRepository.findByUserAndMedia(input.userId, input.mediaId)
        if (existingLegacy?.status === MediaPurchaseStatus.COMPLETED) {
            throw new Error('Vous avez déjà acheté ce média')
        }

        const existingNew = await transactionRepository.findByUserAndProduct(
            input.userId,
            input.mediaId,
            TransactionType.MEDIA_PURCHASE
        )
        if (existingNew) {
            throw new Error('Vous avez déjà acheté ce média')
        }

        const discountPercent = await BookConfigService.getDiscountForLevel(input.userLevel)

        // Extrait l'ID du vendeur (enseignant)
        let submittedBy: string | undefined
        const submittedById = media.submittedBy as unknown
        if (submittedById) {
            if (typeof submittedById === 'object' && '_id' in (submittedById as object)) {
                submittedBy = String((submittedById as { _id: unknown })._id)
            } else {
                submittedBy = String(submittedById)
            }
        }

        const paymentCurrency = input.paymentCurrency ?? media.currency
        const paymentResult = await paymentSDK.payments.initiatePayment({
            userId: input.userId,
            userEmail: input.userEmail,
            type: TransactionType.MEDIA_PURCHASE,
            productId: input.mediaId,
            productType: 'Media',
            amount: media.price,
            originalCurrency: media.currency,
            paymentCurrency,
            description: `Achat média : ${media.title}`,
            callbackUrl: input.callbackUrl,
            discountPercent,
            sellerId: submittedBy,
        })

        // Crée l'entrée MediaPurchase (enregistrement local du paiement)
        const config = await bookConfigRepository.getOrCreate()
        const commissionRate = config.commissionRate ?? 5
        const platformCommission = Math.round(paymentResult.finalAmount * (commissionRate / 100))
        const teacherAmount = paymentResult.finalAmount - platformCommission

        await mediaPurchaseRepository.create({
            mediaId: new mongoose.Types.ObjectId(input.mediaId),
            userId: new mongoose.Types.ObjectId(input.userId),
            originalPrice: media.price,
            discountPercent,
            finalAmount: paymentResult.finalAmount,
            currency: paymentCurrency,
            paymentReference: paymentResult.reference,
            paymentProvider: paymentResult.provider,
            status: MediaPurchaseStatus.PENDING,
            teacherAmount,
            platformCommission,
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            reference: paymentResult.reference,
            provider: paymentResult.provider,
            originalPrice: media.price,
            discountPercent,
            finalAmount: paymentResult.finalAmount,
            currency: paymentCurrency,
            exchangeRate: paymentResult.exchangeRate,
            convertedAmount: paymentResult.convertedAmount,
        }
    }

    /** Vérifie si un utilisateur a accès à un média (achat ou gratuit). */
    static async hasAccess(userId: string, mediaId: string): Promise<boolean> {
        const media = await mediaRepository.findById(mediaId)
        if (!media) return false
        if (media.price === 0) return true
        return mediaPurchaseRepository.hasAccess(userId, mediaId)
    }

    /** Retourne la liste des médias achetés par un utilisateur. */
    static async getPurchasedMedia(
        userId: string,
        page = 1,
        limit = 20
    ): Promise<IMediaPurchase[]> {
        return mediaPurchaseRepository.findByUser(userId, page, limit)
    }
}
