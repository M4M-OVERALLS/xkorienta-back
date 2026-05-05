import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'

/**
 * POST /api/public/mini-tests/[id]/submit
 * Soumet la tentative guest complète et retourne les résultats
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await params // Consume params even if unused to satisfy Next.js 16
    try {
        await connectDB()

        const body = await req.json()
        const { attemptId, guestSessionId } = body

        if (!attemptId || !guestSessionId) {
            return NextResponse.json(
                { success: false, message: 'Attempt ID and guest session ID required' },
                { status: 400 }
            )
        }

        const result = await GuestAttemptService.submitGuestAttempt(attemptId, guestSessionId)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Guest Submit] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to submit attempt' },
            { status: 400 }
        )
    }
}
