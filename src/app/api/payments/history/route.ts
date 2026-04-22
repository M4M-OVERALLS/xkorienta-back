import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentController } from '@/lib/controllers/PaymentController'

/** GET /api/payments/history — Get user's transaction history */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await PaymentController.getHistory(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
