import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'
import QuestionBank from '@/models/Question'

/**
 * GET /api/questions/:id
 *
 * Récupérer une question par ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const { id } = await params

        const question = await QuestionBank.findById(id)
            .populate('subject', 'name')
            .populate('syllabus', 'title')
            .populate('learningUnit', 'title')
            .populate('concepts', 'title')

        if (!question) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'QuestionBank introuvable'
                },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: question
        })
    } catch (error: any) {
        console.error('[API] Error fetching question:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération de la question'
            },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/questions/:id
 *
 * Modifier une question
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const { id } = await params
        const body = await request.json()

        const question = await QuestionBank.findById(id)

        if (!question) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'QuestionBank introuvable'
                },
                { status: 404 }
            )
        }

        // Compatibilité avec d'anciens schémas qui stockent createdBy
        const questionOwnerId = (question as unknown as { createdBy?: { toString(): string } }).createdBy?.toString()
        if (questionOwnerId && questionOwnerId !== session.user.id && session.user.role !== 'ADMIN') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Non autorisé : vous n\'êtes pas le créateur de cette question'
                },
                { status: 403 }
            )
        }

        // Mettre à jour
        Object.assign(question, body)
        await question.save()

        return NextResponse.json({
            success: true,
            data: question
        })
    } catch (error: any) {
        console.error('[API] Error updating question:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la mise à jour de la question'
            },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/questions/:id
 *
 * Supprimer une question
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const { id } = await params

        const question = await QuestionBank.findById(id)

        if (!question) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'QuestionBank introuvable'
                },
                { status: 404 }
            )
        }

        // Compatibilité avec d'anciens schémas qui stockent createdBy
        const questionOwnerId = (question as unknown as { createdBy?: { toString(): string } }).createdBy?.toString()
        if (questionOwnerId && questionOwnerId !== session.user.id && session.user.role !== 'ADMIN') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Non autorisé : vous n\'êtes pas le créateur de cette question'
                },
                { status: 403 }
            )
        }

        await question.deleteOne()

        return NextResponse.json({
            success: true,
            message: 'QuestionBank supprimée avec succès'
        })
    } catch (error: any) {
        console.error('[API] Error deleting question:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la suppression de la question'
            },
            { status: 500 }
        )
    }
}
