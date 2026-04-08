import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * POST /api/exams/v4/:draftId/publish
 *
 * Publier un examen (le rendre actif et accessible aux élèves)
 *
 * Response:
 * {
 *   success: true,
 *   data: IExam (examen publié)
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

        // TODO: Vérifier les permissions (ex: TEACHER, SCHOOL_ADMIN)
        // if (session.user.role !== 'TEACHER' && session.user.role !== 'SCHOOL_ADMIN') {
        //     return NextResponse.json(
        //         { success: false, error: 'Permissions insuffisantes' },
        //         { status: 403 }
        //     )
        // }

        const { draftId } = await params
        const exam = await ExamServiceV4.publish(draftId)

        return NextResponse.json({
            success: true,
            data: exam
        })
    } catch (error: any) {
        console.error('[API] Error publishing exam:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes('Validation échouée')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la publication'
            },
            { status: 500 }
        )
    }
}
