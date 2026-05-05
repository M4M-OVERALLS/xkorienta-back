import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { z } from 'zod'

const PaymentInfoSchema = z.object({
    mobileMoneyPhone:    z.string().min(9).max(20),
    mobileMoneyProvider: z.enum(['orange', 'mtn', 'other']),
    mobileMoneyName:     z.string().min(2).max(100),
})

/**
 * GET /api/seller/payment-info
 * Retourne les coordonnées Mobile Money du vendeur connecté.
 *
 * PUT /api/seller/payment-info
 * Met à jour les coordonnées Mobile Money (pour le virement automatique NotchPay).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        await connectDB()
        const user = await User.findById(session.user.id).select('paymentInfo').lean()
        return NextResponse.json({ success: true, data: (user as any)?.paymentInfo ?? null })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const parsed = PaymentInfoSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: 'Données invalides', errors: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()
        await User.findByIdAndUpdate(session.user.id, { $set: { paymentInfo: parsed.data } })
        return NextResponse.json({ success: true, data: parsed.data })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}

/**
 * DELETE /api/seller/payment-info
 * Supprime les coordonnées Mobile Money (désactive le virement automatique).
 */
export async function DELETE() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        await connectDB()
        await User.findByIdAndUpdate(session.user.id, { $unset: { paymentInfo: '' } })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
