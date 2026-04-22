import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentController } from '@/lib/controllers/PaymentController'

/** POST /api/payments/initiate — Initiate a payment */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await PaymentController.initiatePayment(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('not found') ? 404
            : message.includes('already') ? 409
            : message.includes('free') ? 400
            : message.includes('not available') ? 400
            : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
