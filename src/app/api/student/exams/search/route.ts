import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { AlternativeExamsService } from '@/lib/services/AlternativeExamsService'

/**
 * GET /api/student/exams/search
 * Recherche d'examens par UE pour l'onglet "S'entraîner ailleurs"
 * Query params:
 * - learningUnitId (required)
 * - page (optional, default: 1)
 * - limit (optional, default: 10)
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: 'Non authentifié' },
                { status: 401 }
            )
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const learningUnitId = searchParams.get('learningUnitId')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        if (!learningUnitId) {
            return NextResponse.json(
                { success: false, message: 'learningUnitId requis' },
                { status: 400 }
            )
        }

        const result = await AlternativeExamsService.searchExamsByLearningUnit(
            session.user.id,
            learningUnitId,
            page,
            limit
        )

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Search Exams API] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Erreur serveur' },
            { status: 500 }
        )
    }
}
