import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentController } from '@/lib/controllers/PaymentController'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/** GET /api/admin/payments/transactions — Get all transactions */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await PaymentController.adminGetTransactions(req)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
