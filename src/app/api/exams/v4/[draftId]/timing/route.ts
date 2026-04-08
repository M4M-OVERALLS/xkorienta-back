import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4, UpdateTimingDTO } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * PUT /api/exams/v4/:draftId/timing
 *
 * Mettre à jour le timing (dates + durée) d'un brouillon
 *
 * Body:
 * {
 *   startTime: Date
 *   endTime: Date
 *   duration: number
 * }
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ draftId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const body: UpdateTimingDTO = await request.json()

        // Validation
        if (!body.startTime || !body.endTime || !body.duration) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'startTime, endTime et duration sont requis'
                },
                { status: 400 }
            )
        }

        const { draftId } = await params
        const result = await ExamServiceV4.updateTiming(draftId, body)

        return NextResponse.json({
            success: true, // Sauvegarde réussie
            validation: result.validation
        })
    } catch (error: any) {
        console.error('[API] Error updating timing:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la mise à jour du timing'
            },
            { status: 500 }
        )
    }
}
