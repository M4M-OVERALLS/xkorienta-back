import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SubscriptionController } from '@/lib/controllers/SubscriptionController'

/** POST /api/subscriptions/mine/renew — Renew my subscription */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return await SubscriptionController.renewMine(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('not found') ? 404 : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
