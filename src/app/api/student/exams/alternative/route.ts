import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { AlternativeExamsService } from '@/lib/services/AlternativeExamsService'

/**
 * GET /api/student/exams/alternative
 * Récupère les examens avec système de fallback automatique
 * Query params:
 * - learningUnitId (optional)
 * - subjectId (optional)
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
        const learningUnitId = searchParams.get('learningUnitId') || undefined
        const subjectId = searchParams.get('subjectId') || undefined

        const result = await AlternativeExamsService.getExamsWithFallback(
            session.user.id,
            learningUnitId,
            subjectId
        )

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Alternative Exams API] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Erreur serveur' },
            { status: 500 }
        )
    }
}
