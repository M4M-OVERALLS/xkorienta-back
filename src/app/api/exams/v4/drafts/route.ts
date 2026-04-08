import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * GET /api/exams/v4/drafts
 *
 * Lister les brouillons de l'utilisateur authentifié
 *
 * Response:
 * {
 *   success: true,
 *   data: IExam[],
 *   count: number
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

        const drafts = await ExamServiceV4.listDrafts(session.user.id)

        return NextResponse.json({
            success: true,
            data: drafts,
            count: drafts.length
        })
    } catch (error: any) {
        console.error('[API] Error listing drafts:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération des brouillons'
            },
            { status: 500 }
        )
    }
}
