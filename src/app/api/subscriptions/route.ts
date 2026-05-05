import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SubscriptionController } from '@/lib/controllers/SubscriptionController'

/** POST /api/subscriptions — Subscribe to a plan */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await SubscriptionController.subscribe(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('not found') ? 404
            : message.includes('already') ? 409
            : message.includes('not active') ? 400
            : message.includes('free') ? 400
            : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
