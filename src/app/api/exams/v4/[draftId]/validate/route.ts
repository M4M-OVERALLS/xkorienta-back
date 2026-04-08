import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * POST /api/exams/v4/:draftId/validate
 *
 * Valider un brouillon complet
 *
 * Response:
 * {
 *   success: boolean
 *   validation: {
 *     valid: boolean
 *     errors: string[]
 *     warnings: string[]
 *   }
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

        const { draftId } = await params
        const validation = await ExamServiceV4.validate(draftId)

        return NextResponse.json({
            success: true,
            validation
        })
    } catch (error: any) {
        console.error('[API] Error validating exam:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la validation'
            },
            { status: 500 }
        )
    }
}
