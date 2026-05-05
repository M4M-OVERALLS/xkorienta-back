import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'

/**
 * GET /api/public/mini-tests/[id]/results
 * Récupère les résultats détaillés d'une tentative guest
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await params // Consume params even if unused to satisfy Next.js 16
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        const attemptId = searchParams.get('attemptId')
        const guestSessionId = searchParams.get('guestSessionId')

        if (!attemptId || !guestSessionId) {
            return NextResponse.json(
                { success: false, message: 'Attempt ID and guest session ID required' },
                { status: 400 }
            )
        }

        const result = await GuestAttemptService.getGuestAttemptResults(attemptId, guestSessionId)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Guest Results] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch results' },
            { status: 400 }
        )
    }
}
