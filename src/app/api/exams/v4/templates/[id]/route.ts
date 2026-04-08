import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'

/**
 * GET /api/exams/v4/templates/:id
 *
 * Obtenir un template d'examen par ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const template = await ExamServiceV4.getTemplate(id)

        if (!template) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Template introuvable'
                },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: template
        })
    } catch (error: any) {
        console.error('[API] Error getting template:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de la récupération du template'
            },
            { status: 500 }
        )
    }
}
