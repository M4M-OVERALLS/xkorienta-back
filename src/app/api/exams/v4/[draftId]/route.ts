import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * DELETE /api/exams/v4/:draftId
 *
 * Supprimer un brouillon
 */
export async function DELETE(
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
        await ExamServiceV4.deleteDraft(draftId, session.user.id)

        return NextResponse.json({
            success: true,
            message: 'Brouillon supprimé avec succès'
        })
    } catch (error: any) {
        console.error('[API] Error deleting draft:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes('Non autorisé')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 403 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la suppression'
            },
            { status: 500 }
        )
    }
}
