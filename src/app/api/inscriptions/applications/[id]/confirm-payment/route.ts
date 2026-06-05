import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import SchoolApplication from '@/models/SchoolApplication'
import { ApplicationStatus, PaymentStatus } from '@/models/enums'

type RouteParams = { params: Promise<{ id: string }> }

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
