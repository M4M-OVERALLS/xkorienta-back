import { NextRequest, NextResponse } from 'next/server'
import { SelfAssessmentService, SubmitSelfAssessmentDTO } from '@/lib/services/SelfAssessmentService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/self-assessments/submit
 *
 * Soumettre une auto-évaluation
 *
 * Body:
 * {
 *   examId: string
 *   conceptAssessments: Array<{
 *     conceptId: string
 *     level: SelfAssessmentLevel (0-6)
 *   }>
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     result: ISelfAssessmentResult,
 *     competencyMap: CompetencyMap,
 *     recommendations: Recommendations
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const body = await request.json()

        // Validation
        if (!body.examId) {
            return NextResponse.json(
                { success: false, error: 'L\'examId est requis' },
                { status: 400 }
            )
        }

        if (!body.conceptAssessments || !Array.isArray(body.conceptAssessments)) {
            return NextResponse.json(
                { success: false, error: 'Les évaluations de concepts sont requises' },
                { status: 400 }
            )
        }

        const dto: SubmitSelfAssessmentDTO = {
            examId: body.examId,
            studentId: session.user.id,
            conceptAssessments: body.conceptAssessments
        }

        const result = await SelfAssessmentService.submit(dto)

        return NextResponse.json({
            success: true,
            data: result
        }, { status: 201 })
    } catch (error: any) {
        console.error('[API] Error submitting self-assessment:', error)

        if (error.message.includes('introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes('n\'est pas une auto-évaluation') ||
            error.message.includes('Vous devez évaluer tous les concepts')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la soumission de l\'auto-évaluation'
            },
            { status: 500 }
        )
    }
}
