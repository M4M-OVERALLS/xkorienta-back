import { NextRequest, NextResponse } from 'next/server'
import { SelfAssessmentService } from '@/lib/services/SelfAssessmentService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/self-assessments/concept-history
 *
 * Obtenir l'historique de progression d'un élève sur un concept
 *
 * Query params:
 * - conceptId: string (requis)
 * - studentId?: string (optionnel, par défaut l'utilisateur authentifié)
 *
 * Response:
 * {
 *   success: true,
 *   data: Array<{
 *     date: Date,
 *     level: number (0-6)
 *   }>
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const conceptId = searchParams.get('conceptId')
        const studentId = searchParams.get('studentId') || session.user.id

        if (!conceptId) {
            return NextResponse.json(
                { success: false, error: 'Le conceptId est requis' },
                { status: 400 }
            )
        }

        // TODO: Vérifier les permissions si studentId != session.user.id

        const history = await SelfAssessmentService.getConceptHistory(studentId, conceptId)

        return NextResponse.json({
            success: true,
            data: history
        })
    } catch (error: any) {
        console.error('[API] Error getting concept history:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération de l\'historique'
            },
            { status: 500 }
        )
    }
}
