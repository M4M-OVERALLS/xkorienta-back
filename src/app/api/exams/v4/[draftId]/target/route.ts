import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4, UpdateTargetDTO } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * PUT /api/exams/v4/:draftId/target
 *
 * Mettre à jour la cible pédagogique (matière + syllabus + chapitres) d'un brouillon
 *
 * Body:
 * {
 *   subjectId: string
 *   syllabusId?: string
 *   learningUnitIds?: string[]
 *   chapterWeights?: Array<{ learningUnit: string, weight: number }>
 *   linkedConceptIds?: string[]
 *   targetFieldIds?: string[]
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
        const body: UpdateTargetDTO = await request.json()

        // Validation
        if (!body.subjectId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'La matière (subjectId) est requise'
                },
                { status: 400 }
            )
        }

        const result = await ExamServiceV4.updateTarget(draftId, body)

        return NextResponse.json({
            success: true, // Sauvegarde réussie
            validation: result.validation
        })
    } catch (error: any) {

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la mise à jour de la cible'
            },
            { status: 500 }
        )
    }
}
