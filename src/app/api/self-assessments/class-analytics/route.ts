import { NextRequest, NextResponse } from 'next/server'
import { SelfAssessmentService } from '@/lib/services/SelfAssessmentService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Class from '@/models/Class'

/**
 * GET /api/self-assessments/class-analytics
 *
 * Obtenir les analytics d'auto-évaluation pour une classe sur un chapitre
 * (Vue enseignant)
 *
 * Query params:
 * - chapterId: string (requis)
 * - classId: string (requis)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     totalStudents: number,
 *     averageClassScore: number,
 *     conceptDifficulty: [...],
 *     conceptsNeedingReview: [...],
 *     studentResults: [...]
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

        // TODO: Vérifier que l'utilisateur est enseignant
        // if (session.user.role !== 'TEACHER' && session.user.role !== 'SCHOOL_ADMIN') {
        //     return NextResponse.json(
        //         { success: false, error: 'Permissions insuffisantes' },
        //         { status: 403 }
        //     )
        // }

        const searchParams = request.nextUrl.searchParams
        const chapterId = searchParams.get('chapterId')
        const classId = searchParams.get('classId')

        if (!chapterId || !classId) {
            return NextResponse.json(
                { success: false, error: 'chapterId et classId sont requis' },
                { status: 400 }
            )
        }

        // Récupérer les IDs des élèves de la classe
        const classDoc = await Class.findById(classId).populate('students')
        if (!classDoc) {
            return NextResponse.json(
                { success: false, error: 'Classe introuvable' },
                { status: 404 }
            )
        }

        // TODO: Vérifier que l'enseignant a accès à cette classe

        const studentIds = classDoc.students.map((s: any) => s._id.toString())

        const analytics = await SelfAssessmentService.getClassAnalytics(chapterId, studentIds)

        return NextResponse.json({
            success: true,
            data: analytics
        })
    } catch (error: any) {
        console.error('[API] Error getting class analytics:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération des analytics'
            },
            { status: 500 }
        )
    }
}
