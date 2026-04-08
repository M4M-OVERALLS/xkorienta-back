import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * POST /api/exams/v4/:draftId/resume
 *
 * Reprendre un brouillon existant pour continuer son édition
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     exam: IExam,
 *     validation: ValidationResult
 *   }
 * }
 */
export async function POST(
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

        const { draftId } = await params
        const result = await ExamServiceV4.resumeDraft(draftId, session.user.id)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[API] Error resuming draft:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes('Non autorisé')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 403 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la reprise du brouillon'
            },
            { status: 500 }
        )
    }
}
