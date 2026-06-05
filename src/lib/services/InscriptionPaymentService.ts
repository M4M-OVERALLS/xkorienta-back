import { paymentSDK } from '@/lib/payment'
import { SchoolApplicationRepository } from '@/lib/repositories/SchoolApplicationRepository'
import { InscriptionFormRepository } from '@/lib/repositories/InscriptionFormRepository'
import { InscriptionError } from '@/lib/errors'
import {
    ApplicationStatus,
    InscriptionFormStatus,
    PaymentStatus,
    TransactionType,
} from '@/models/enums'

// ── Types ───────────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
    applicationId: string
    userId?: string
    userEmail: string
    callbackUrl: string
    paymentCurrency?: string
}

export interface PaymentResult {
    paymentUrl: string
    reference: string
    finalAmount: number
    currency: string
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * InscriptionPaymentService — initier et suivre le paiement d'une candidature.
 *
 * Pattern identique a BookPurchaseService :
 *   1. Valider l'application + la fiche
 *   2. Initier le paiement via paymentSDK
 *   3. Stocker la reference sur l'application
 *   4. Retourner l'URL de paiement NotchPay
 *
 * Le webhook est gere par le handler EventBus dans payment.ts
 * (ajoute dans ce sprint).
 */
export class InscriptionPaymentService {
    /**
     * Initier le paiement d'une candidature.
     */
    static async initiatePayment(input: InitiatePaymentInput): Promise<PaymentResult> {
        const appRepo = new SchoolApplicationRepository()
        const formRepo = new InscriptionFormRepository()

        // 1. Charger l'application
        const application = await appRepo.findById(input.applicationId)
        if (!application) throw InscriptionError.formNotFound()

        // 2. Verifier que l'application est en statut SUBMITTED + paiement PENDING
        if (application.appStatus !== ApplicationStatus.SUBMITTED) {
            throw InscriptionError.invalidTransition(application.appStatus, ApplicationStatus.PAID)
        }
        if (application.paymentStatus !== PaymentStatus.PENDING) {
            throw InscriptionError.invalidTransition(
                `payment:${application.paymentStatus}`,
                `payment:${PaymentStatus.PAID}`,
            )
        }

        // 3. Charger la fiche d'inscription
        const rawFormId = application.inscriptionFormId as unknown
        const formId = typeof rawFormId === 'object' && rawFormId !== null && '_id' in (rawFormId as Record<string, unknown>)
            ? String((rawFormId as { _id: unknown })._id)
            : String(rawFormId)
        const form = await formRepo.findById(formId)
        if (!form) throw InscriptionError.formNotFound()

        // 4. Verifier que la fiche est encore ouverte
        if (form.status !== InscriptionFormStatus.PUBLISHED) {
            throw InscriptionError.inscriptionClosed()
        }
        const now = new Date()
        if (now > new Date(form.closesAt)) {
            throw InscriptionError.inscriptionClosed()
        }

        // 5. Extraire le sellerId (admin ecole = beneficiaire)
        const createdById = form.createdBy as unknown
        const sellerId = createdById
            ? typeof createdById === 'object' && '_id' in (createdById as object)
                ? String((createdById as { _id: unknown })._id)
                : String(createdById)
            : undefined

        // 6. Initier le paiement
        const isGuest = !input.userId

        if (isGuest) {
            // Anonyme : appeler le provider directement (pas le SDK qui exige un userId ObjectId)
            const provider = paymentSDK.providers.get('notchpay')
            const reference = `INS-GUEST-${form._id.toString().slice(-6)}-${Date.now().toString(36)}`

            const result = await provider.initiatePayment({
                amount: form.price,
                currency: 'XAF',
                reference,
                email: input.userEmail,
                description: `Inscription: ${form.title}`,
                callbackUrl: input.callbackUrl,
                metadata: {
                    applicationId: input.applicationId,
                    schoolId: form.schoolId?.toString(),
                    formTitle: form.title,
                    isGuest: 'true',
                    type: TransactionType.SCHOOL_INSCRIPTION,
                },
            })

            await appRepo.updatePayment(input.applicationId, {
                paymentStatus: PaymentStatus.PENDING,
                paymentRef: reference,
            })

            return {
                paymentUrl: result.paymentUrl,
                reference,
                finalAmount: form.price,
                currency: 'XAF',
            }
        }

        // Connecte : utiliser le SDK complet (cree un Transaction + gere le webhook)
        const paymentResult = await paymentSDK.payments.initiatePayment({
            userId: input.userId!,
            userEmail: input.userEmail,
            type: TransactionType.SCHOOL_INSCRIPTION,
            productId: form._id.toString(),
            productType: 'InscriptionForm',
            amount: form.price,
            originalCurrency: 'XAF',
            paymentCurrency: input.paymentCurrency ?? 'XAF',
            description: `Inscription: ${form.title}`,
            callbackUrl: input.callbackUrl,
            discountPercent: 0,
            sellerId,
            metadata: {
                applicationId: input.applicationId,
                schoolId: form.schoolId?.toString(),
                formTitle: form.title,
            },
        })

        // Stocker la reference de paiement sur l'application
        await appRepo.updatePayment(input.applicationId, {
            paymentStatus: PaymentStatus.PENDING,
            paymentRef: paymentResult.reference,
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            reference: paymentResult.reference,
            finalAmount: paymentResult.finalAmount,
            currency: paymentResult.paymentCurrency ?? 'XAF',
        }
    }

    /**
     * Recuperer le statut d'une candidature (pour le polling frontend).
     */
    static async getApplicationStatus(applicationId: string) {
        const appRepo = new SchoolApplicationRepository()
        const application = await appRepo.findById(applicationId)
        if (!application) throw InscriptionError.formNotFound()

        return {
            appStatus: application.appStatus,
            paymentStatus: application.paymentStatus,
            paymentRef: application.paymentRef,
            paidAt: application.paidAt,
        }
    }
}
