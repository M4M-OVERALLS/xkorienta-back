import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PayoutService } from '@/lib/services/PayoutService'
import { MobileMoneyProvider, Currency } from '@/models/enums'
import { z } from 'zod'

const PayoutRequestSchema = z.object({
    amount: z.number().int().positive(),
    currency: z.nativeEnum(Currency).default(Currency.XAF),
    recipientPhone: z.string().min(9).max(20),
    recipientName: z.string().min(2).max(100),
    recipientProvider: z.nativeEnum(MobileMoneyProvider),
})

/**
 * POST /api/seller/payout
 * Demande un virement des gains vers Mobile Money.
 *
 * Body: { amount, currency, recipientPhone, recipientName, recipientProvider }
 *
 * GET /api/seller/payout
 * Historique des virements du vendeur.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const parsed = PayoutRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: 'Données invalides', errors: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const payout = await PayoutService.requestPayout({
            userId: session.user.id as string,
            ...parsed.data,
        })

        return NextResponse.json({ success: true, data: payout }, { status: 201 })
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('insuffisant') || message.includes('introuvable') ? 400 : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') ?? '1', 10)
        const limit = parseInt(searchParams.get('limit') ?? '20', 10)

        const payouts = await PayoutService.getPayoutHistory(
            session.user.id as string,
            page,
            limit
        )

        return NextResponse.json({ success: true, data: payouts })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
