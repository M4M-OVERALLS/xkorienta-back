import { NextResponse } from 'next/server'
import { BookAdminController } from '@/lib/controllers/BookAdminController'

/**
 * POST /api/books/purchase/webhook
 * Receives payment notifications from NotchPay.
 * No authentication — payload integrity verified via HMAC signature.
 */
export async function POST(req: Request) {
    try {
        return await BookAdminController.handleWebhook(req)
    } catch (err) {
        // Return 200 to prevent NotchPay from retrying on signature errors
        console.error('[Webhook] Error processing payment webhook:', (err as Error).message)
        return NextResponse.json({ success: false }, { status: 200 })
    }
}
