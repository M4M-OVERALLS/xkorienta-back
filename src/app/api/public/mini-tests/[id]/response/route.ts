import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'

/**
 * POST /api/public/mini-tests/[id]/response
 * Soumet une réponse individuelle pour un guest
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await params // Consume params even if unused to satisfy Next.js 16
    try {
        await connectDB()

        const body = await req.json()
        const { attemptId, questionId, selectedOptionId, textResponse, guestSessionId } = body

        if (!attemptId || !questionId || !guestSessionId) {
            return NextResponse.json(
                { success: false, message: 'Attempt ID, question ID, and guest session ID required' },
                { status: 400 }
            )
        }

        const result = await GuestAttemptService.submitGuestResponse(
            attemptId,
            questionId,
            selectedOptionId || null,
            textResponse || null,
            guestSessionId
        )

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Guest Response] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to submit response' },
            { status: 400 }
        )
    }
}
