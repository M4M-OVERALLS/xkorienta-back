import { NextResponse } from 'next/server'
import { PaymentController } from '@/lib/controllers/PaymentController'

/**
 * POST /api/payments/webhook/notchpay
 * Receives payment notifications from NotchPay.
 * No authentication — payload integrity verified via HMAC signature.
 */
export async function POST(req: Request) {
    try {
        return await PaymentController.handleNotchPayWebhook(req)
    } catch (err) {
        // Return 200 to prevent NotchPay from retrying on signature errors
        return NextResponse.json({ success: false }, { status: 200 })
    }
}
