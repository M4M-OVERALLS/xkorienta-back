import { NextResponse } from 'next/server'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'

type Params = { params: Promise<{ reference: string }> }

/**
 * GET /api/books/purchase/guest/status/:reference
 * Public status lookup for guest checkout return flow.
 */
export async function GET(_req: Request, { params }: Params) {
    try {
        const { reference } = await params
        const purchase = await guestPurchaseRepository.findByReference(reference)

        if (!purchase) {
            return NextResponse.json(
                { success: false, message: 'Référence introuvable' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                reference,
                status: purchase.status,
            },
        })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message || 'Erreur interne' },
            { status: 500 }
        )
    }
}

