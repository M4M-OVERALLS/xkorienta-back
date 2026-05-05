import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentController } from '@/lib/controllers/PaymentController'

type Params = { params: Promise<{ reference: string }> }

/** GET /api/payments/:reference — Get transaction status */
export async function GET(req: Request, { params }: Params) {
    try {
        const { reference } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await PaymentController.getTransactionStatus(reference, session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
