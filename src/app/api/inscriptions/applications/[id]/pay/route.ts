import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { InscriptionPaymentService } from '@/lib/services/InscriptionPaymentService'
import { BaseApplicationError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/inscriptions/applications/:id/pay
 * Initier le paiement NotchPay pour une candidature soumise.
 * Body: { callbackUrl: string, paymentCurrency?: string, guestEmail?: string }
 */
export async function POST(req: Request, { params }: RouteParams) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        await connectDB()

        const body = await req.json()
        const callbackUrl = body.callbackUrl as string
        if (!callbackUrl) {
            return NextResponse.json({ success: false, message: 'callbackUrl requis' }, { status: 400 })
        }

        // User connecte ou anonyme (guestEmail)
        const userEmail = session?.user?.email ?? body.guestEmail
        if (!userEmail) {
            return NextResponse.json(
                { success: false, message: 'Connexion requise ou email obligatoire' },
                { status: 400 },
            )
        }

        const result = await InscriptionPaymentService.initiatePayment({
            applicationId: id,
            userId: session?.user?.id,
            userEmail,
            callbackUrl,
            paymentCurrency: body.paymentCurrency,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    } catch (error: unknown) {
        if (error instanceof BaseApplicationError) {
            error.log()
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
