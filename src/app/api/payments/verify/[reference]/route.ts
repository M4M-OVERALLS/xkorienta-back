import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentController } from '@/lib/controllers/PaymentController'

type Params = { params: Promise<{ reference: string }> }

/**
 * POST /api/payments/verify/:reference[?providerRef=...]
 * Verify payment with provider.
 *
 * `providerRef` (optional) = NotchPay's own reference (e.g. `trx.test_...`)
 * forwarded from the return URL. Needed because NotchPay's GET /payments/:id
 * only accepts their internal reference, not our merchant reference.
 */
export async function POST(req: Request, { params }: Params) {
    try {
        const { reference } = await params
        const url = new URL(req.url)
        const providerRef = url.searchParams.get('providerRef')?.trim() || null

        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await PaymentController.verifyPayment(reference, session as any, providerRef)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
