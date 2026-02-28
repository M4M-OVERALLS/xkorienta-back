import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { GuestAttemptService } from '@/lib/services/GuestAttemptService'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/public/mini-tests/[id]/start
 * Démarre une tentative guest pour un mini-test public
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB()

        const { id: examId } = await params
        const body = await req.json()
        
        // Récupérer ou créer un guestSessionId
        let { guestSessionId } = body
        
        if (!guestSessionId) {
            // Générer un nouveau UUID pour cette session guest
            guestSessionId = uuidv4()
        }

        const result = await GuestAttemptService.startGuestAttempt(examId, guestSessionId)

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                guestSessionId // Retourner le sessionId pour que le frontend le stocke
            }
        })
    } catch (error: any) {
        console.error('[Guest Start Attempt] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to start attempt' },
            { status: 400 }
        )
    }
}
