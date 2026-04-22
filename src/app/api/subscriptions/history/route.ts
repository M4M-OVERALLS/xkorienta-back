import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SubscriptionController } from '@/lib/controllers/SubscriptionController'

/** GET /api/subscriptions/history — Get my subscription history */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await SubscriptionController.getHistory(session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
