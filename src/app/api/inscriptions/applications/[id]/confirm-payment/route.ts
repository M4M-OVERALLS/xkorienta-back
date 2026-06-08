import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import mongoose from 'mongoose'
import SchoolApplication from '@/models/SchoolApplication'
import InscriptionForm from '@/models/InscriptionForm'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { ApplicationStatus, PaymentStatus } from '@/models/enums'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Genere le recu d'inscription pour une candidature payee.
 * Idempotent et non-bloquant : les erreurs sont capturees par Sentry.
 * Retourne l'id de facture a lier sur l'application, si creee.
 */
async function generateInscriptionInvoice(
    applicationId: string,
    reference: string,
    userId?: { toString(): string },
): Promise<string | undefined> {
    const populated = await SchoolApplication.findById(applicationId)
        .populate('userId', 'name email')
        .lean()
    const form = await InscriptionForm.findById(populated?.inscriptionFormId)
        .select('title price commissionRate')
        .lean()
    if (!form || !populated) return undefined

    const buyer = populated.userId as { name?: string; email?: string } | null | undefined
    const candidate = populated.candidateData ?? {}
    const buyerName =
        buyer?.name ??
        (typeof candidate.nom === 'string' ? candidate.nom : undefined) ??
        'Candidat'
    const buyerEmail = buyer?.email ?? populated.guestEmail

    const invoice = await InvoiceService.generateForInscription({
        paymentReference: reference,
        recipientId: userId?.toString(),
        isGuest: !userId,
        buyerName,
        buyerEmail,
        formTitle: form.title,
        price: form.price,
        commissionRate: form.commissionRate ?? 5,
        currency: 'XAF',
    })

    return invoice?._id?.toString()
}

/**
 * POST /api/inscriptions/applications/:id/confirm-payment
 *
 * Confirme le paiement d'une candidature apres retour de NotchPay.
 * Utilise pour les paiements guest (pas de Transaction/webhook SDK).
 *
 * Body: { reference: string, status: "complete" }
 *
 * Securite : verifie que la reference correspond a celle stockee sur l'application
 * et que le statut NotchPay est "complete".
 */
export async function POST(req: Request, { params }: RouteParams) {
    try {
        const { id } = await params
        await connectDB()

        const body = await req.json()
        const { reference, status } = body as { reference?: string; status?: string }

        if (!reference || status !== 'complete') {
            return NextResponse.json({ success: false, message: 'Paiement non confirme' }, { status: 400 })
        }

        const app = await SchoolApplication.findById(id)
        if (!app) {
            return NextResponse.json({ success: false, message: 'Candidature introuvable' }, { status: 404 })
        }

        // Verifier que la reference correspond
        if (app.paymentRef !== reference) {
            return NextResponse.json({ success: false, message: 'Reference de paiement invalide' }, { status: 400 })
        }

        // Deja payee — idempotent
        if (app.appStatus === ApplicationStatus.PAID) {
            return NextResponse.json({ success: true, data: { appStatus: app.appStatus, paymentStatus: app.paymentStatus } })
        }

        // Mettre a jour le statut
        app.appStatus = ApplicationStatus.PAID
        app.paymentStatus = PaymentStatus.PAID
        app.paidAt = new Date()
        await app.save()

        // Generer la facture (reçu d'inscription) — non-bloquant.
        // Idempotent : ne recree pas si une facture existe deja pour cette reference.
        try {
            const invoiceId = await generateInscriptionInvoice(id, reference, app.userId)
            if (invoiceId && !app.invoiceId) {
                app.invoiceId = new mongoose.Types.ObjectId(invoiceId)
                await app.save()
            }
        } catch (invoiceError) {
            Sentry.captureException(invoiceError)
        }

        return NextResponse.json({
            success: true,
            data: { appStatus: app.appStatus, paymentStatus: app.paymentStatus, paidAt: app.paidAt },
        })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
