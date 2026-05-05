import { NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { SubscriptionInterval } from '@/models/enums'

export interface AuthSession {
    user: {
        id: string
        email: string
        role: string
        name?: string
    }
}

export class SubscriptionController {
    /**
     * POST /api/subscriptions
     * Subscribe to a plan.
     */
    static async subscribe(req: Request, session: AuthSession) {
        const body = await req.json() as {
            planCode: string
            interval: SubscriptionInterval
            currency: string
            callbackUrl: string
        }

        if (!body.planCode || !body.interval || !body.currency || !body.callbackUrl) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields: planCode, interval, currency, callbackUrl' },
                { status: 400 }
            )
        }

        if (!['MONTHLY', 'YEARLY'].includes(body.interval)) {
            return NextResponse.json(
                { success: false, message: 'Invalid interval. Must be MONTHLY or YEARLY' },
                { status: 400 }
            )
        }

        const result = await SubscriptionService.subscribe({
            userId: session.user.id,
            userEmail: session.user.email,
            planCode: body.planCode,
            interval: body.interval,
            currency: body.currency.toUpperCase(),
            callbackUrl: body.callbackUrl,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    /**
     * GET /api/subscriptions/mine
     * Get current user's subscription.
     */
    static async getMine(session: AuthSession) {
        const result = await SubscriptionService.getUserSubscription(session.user.id)

        return NextResponse.json({
            success: true,
            data: result,
        })
    }

    /**
     * DELETE /api/subscriptions/mine
     * Cancel current user's subscription.
     */
    static async cancelMine(session: AuthSession) {
        const subscription = await SubscriptionService.cancelSubscription(session.user.id)

        return NextResponse.json({
            success: true,
            data: subscription,
            message: 'Subscription cancelled successfully. You will retain access until the end of your current period.',
        })
    }

    /**
     * POST /api/subscriptions/mine/renew
     * Renew current user's subscription.
     */
    static async renewMine(req: Request, session: AuthSession) {
        const body = await req.json() as { callbackUrl: string }

        if (!body.callbackUrl) {
            return NextResponse.json(
                { success: false, message: 'Missing required field: callbackUrl' },
                { status: 400 }
            )
        }

        const result = await SubscriptionService.renewSubscription(
            session.user.id,
            session.user.email,
            body.callbackUrl
        )

        return NextResponse.json({ success: true, data: result })
    }

    /**
     * GET /api/subscriptions/history
     * Get user's subscription history.
     */
    static async getHistory(session: AuthSession) {
        const subscriptions = await SubscriptionService.getUserSubscriptionHistory(session.user.id)

        return NextResponse.json({
            success: true,
            data: subscriptions,
        })
    }

    /**
     * GET /api/subscriptions/check
     * Check if user has active subscription.
     */
    static async checkActive(session: AuthSession) {
        const hasActive = await SubscriptionService.hasActiveSubscription(session.user.id)

        return NextResponse.json({
            success: true,
            data: { hasActiveSubscription: hasActive },
        })
    }
}
