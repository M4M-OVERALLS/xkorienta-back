import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAnalyticsService } from '@/lib/services/GuestAnalyticsService'

/**
 * GET /api/public/mini-tests/analytics
 * Récupère les analytics et le radar chart pour un guest
 */
export async function GET(req: Request) {
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        const guestSessionId = searchParams.get('guestSessionId')

        if (!guestSessionId) {
            return NextResponse.json(
                { success: false, message: 'Guest session ID required' },
                { status: 400 }
            )
        }

        const analytics = await GuestAnalyticsService.generateInsights(guestSessionId)

        return NextResponse.json({
            success: true,
            data: analytics
        })
    } catch (error: any) {
        console.error('[Guest Analytics] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch analytics' },
            { status: 400 }
        )
    }
}
