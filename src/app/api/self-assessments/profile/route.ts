import { NextRequest, NextResponse } from 'next/server'
import { SelfAssessmentService } from '@/lib/services/SelfAssessmentService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/self-assessments/profile
 *
 * Obtenir le profil global d'auto-évaluation d'un élève pour une matière
 *
 * Query params:
 * - syllabusId: string (requis)
 * - studentId?: string (optionnel, par défaut l'utilisateur authentifié)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     student: string,
 *     syllabus: string,
 *     chapterScores: [...],
 *     overallProgress: {
 *       totalConcepts: number,
 *       masteredConcepts: number,
 *       inProgressConcepts: number,
 *       strugglingConcepts: number,
 *       unknownConcepts: number
 *     }
 *   }
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
        const syllabusId = searchParams.get('syllabusId')
        const studentId = searchParams.get('studentId') || session.user.id

        if (!syllabusId) {
            return NextResponse.json(
                { success: false, error: 'Le syllabusId est requis' },
                { status: 400 }
            )
        }

        // TODO: Vérifier les permissions si studentId != session.user.id
        // (ex: enseignant peut voir le profil de ses élèves)

        const profile = await SelfAssessmentService.getStudentProfile(studentId, syllabusId)

        return NextResponse.json({
            success: true,
            data: profile
        })
    } catch (error: any) {
        console.error('[API] Error getting profile:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération du profil'
            },
            { status: 500 }
        )
    }
}
