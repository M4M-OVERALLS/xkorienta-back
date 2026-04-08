import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4, UpdateMetadataDTO } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'

/**
 * PUT /api/exams/v4/:draftId/metadata
 *
 * Mettre à jour les métadonnées (titre + description + image + tags) d'un brouillon
 *
 * Body:
 * {
 *   title: string
 *   description?: string
 *   imageUrl?: string
 *   tags?: string[]
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

        const body: UpdateMetadataDTO = await request.json()

        // Validation
        if (!body.title || body.title.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le titre est requis'
                },
                { status: 400 }
            )
        }

        const { draftId } = await params
        const result = await ExamServiceV4.updateMetadata(draftId, body)

        return NextResponse.json({
            success: true, // Sauvegarde réussie
            validation: result.validation
        })
    } catch (error: any) {
        console.error('[API] Error updating metadata:', error)

        if (error.message.includes('Brouillon introuvable')) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la mise à jour des métadonnées'
            },
            { status: 500 }
        )
    }
}
