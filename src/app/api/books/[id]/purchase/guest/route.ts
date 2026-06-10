import { NextResponse } from 'next/server'
import { GuestBookPurchaseService } from '@/lib/services/GuestBookPurchaseService'

type Params = { params: Promise<{ id: string }> }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/books/:id/purchase/guest
 * Guest checkout — no authentication required.
 * Requires: { email, callbackUrl? }
 * On successful payment (webhook), a download link is sent by email.
 */
export async function POST(req: Request, { params }: Params) {
    try {
        const { id } = await params

        let body: { email?: string; callbackUrl?: string } = {}
        const raw = await req.text()
        if (raw.trim()) {
            try {
                body = JSON.parse(raw) as typeof body
            } catch {
                return NextResponse.json({ success: false, message: 'Corps JSON invalide' }, { status: 400 })
            }
        }

        const email = body.email?.trim().toLowerCase() ?? ''
        if (!email || !EMAIL_REGEX.test(email)) {
            return NextResponse.json(
                { success: false, message: 'Adresse email invalide' },
                { status: 400 }
            )
        }

        const appBase = (
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXTAUTH_URL ||
            ''
        ).replace(/\/$/, '')
        const callbackUrl =
            body.callbackUrl ?? `${appBase}/bibliotheque/${id}?payment=return&mode=guest`

        const result = await GuestBookPurchaseService.initiateGuestPurchase(id, email, callbackUrl)

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    } catch (err) {
        const message = (err as Error).message
        const status =
            message.includes('already purchased') ? 409
            : message.includes('not found') ? 404
            : message.includes('not available') || message.includes('free') ? 400
            : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
