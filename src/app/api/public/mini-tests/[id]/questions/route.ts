import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'

/**
 * GET /api/public/mini-tests/[id]/questions
 * Récupère les questions d'un mini-test pour un guest
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB()

        const { id: examId } = await params
        const { searchParams } = new URL(req.url)
        const guestSessionId = searchParams.get('guestSessionId')

        if (!guestSessionId) {
            return NextResponse.json(
                { success: false, message: 'Guest session ID required' },
                { status: 400 }
            )
        }

        const result = await GuestAttemptService.getGuestExamQuestions(examId, guestSessionId)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Guest Questions] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch questions' },
            { status: 400 }
        )
    }
}
