import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4, UpdateContextDTO } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * PUT /api/exams/v4/:draftId/context
 *
 * Mettre à jour le contexte (école + niveaux) d'un brouillon
 *
 * Body:
 * {
 *   schoolId?: string
 *   classId?: string
 *   targetLevelIds: string[]
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

        const { draftId } = await params
        const body: UpdateContextDTO = await request.json()

        // Validation
        if (!body.targetLevelIds || body.targetLevelIds.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Au moins un niveau cible est requis'
                },
                { status: 400 }
            )
        }

        const result = await ExamServiceV4.updateContext(draftId, body)

        return NextResponse.json({
            success: true, // Sauvegarde réussie
            validation: result.validation
        })
    } catch (error: any) {
        console.error('[API] Error updating context:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la mise à jour du contexte'
            },
            { status: 500 }
        )
    }
}
