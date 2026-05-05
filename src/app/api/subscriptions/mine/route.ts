import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SubscriptionController } from '@/lib/controllers/SubscriptionController'

/** GET /api/subscriptions/mine — Get my current subscription */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await SubscriptionController.getMine(session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}

/** DELETE /api/subscriptions/mine — Cancel my subscription */
export async function DELETE() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await SubscriptionController.cancelMine(session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('not found') ? 404
            : message.includes('not active') ? 400
            : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
