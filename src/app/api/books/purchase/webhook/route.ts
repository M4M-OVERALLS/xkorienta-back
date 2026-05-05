import { NextResponse } from 'next/server'
import { PaymentController } from '@/lib/controllers/PaymentController'

/**
 * POST /api/books/purchase/webhook
 *
 * @deprecated Utiliser /api/payments/webhook/notchpay (webhook unifié).
 * Cette route reste disponible uniquement pour compatibilité descendante.
 * Elle délègue entièrement au webhook générique.
 */
export async function POST(req: Request) {
    console.warn(
        '[DEPRECATED] /api/books/purchase/webhook est déprécié. ' +
        'Configurer NotchPay avec /api/payments/webhook/notchpay.'
    )
    try {
        return await PaymentController.handleNotchPayWebhook(req)
    } catch (err) {
        console.error('[Webhook] Error processing payment webhook:', (err as Error).message)
        return NextResponse.json({ success: false }, { status: 200 })
    }
}
