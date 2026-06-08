import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { InscriptionPaymentService } from '@/lib/services/InscriptionPaymentService'
import { BaseApplicationError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/inscriptions/applications/:id/status
 * Verifier le statut d'une candidature (polling frontend apres paiement).
 * Public — pas besoin de session (le frontend utilise l'ID de l'application).
 */
export async function GET(_req: Request, { params }: RouteParams) {
    try {
        const { id } = await params
        await connectDB()

        const status = await InscriptionPaymentService.getApplicationStatus(id)
        return NextResponse.json({ success: true, data: status })
    } catch (error: unknown) {
        if (error instanceof BaseApplicationError) {
            Sentry.captureException(error)
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
