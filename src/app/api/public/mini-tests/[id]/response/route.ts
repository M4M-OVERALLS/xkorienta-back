import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'
import logger from '@/lib/utils/logger'

/**
 * POST /api/public/mini-tests/[id]/response
 * Soumet une réponse individuelle pour un guest.
 *
 * SECURITY (A-01): Ne retourne JAMAIS isCorrect dans la réponse.
 * L'évaluation est différée au /submit pour empêcher l'oracle de réponse.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await params
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

        await GuestAttemptService.submitGuestResponse(
            attemptId,
            questionId,
            selectedOptionId || null,
            textResponse || null,
            guestSessionId,
            req.headers
        )

        // A-01: Only return confirmation, never isCorrect
        return NextResponse.json({
            success: true,
            data: { recorded: true }
        })
    } catch (error: any) {
        logger.error('[Guest Response] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to submit response' },
            { status: 400 }
        )
    }
}
