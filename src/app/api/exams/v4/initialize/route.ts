import { NextRequest, NextResponse } from 'next/server'
import { ExamServiceV4, InitializeExamDTO } from '@/lib/services/ExamServiceV4'
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth' // Adapter selon votre système d'authentification

/**
 * POST /api/exams/v4/initialize
 *
 * Initialiser un nouveau builder d'examen avec un template
 *
 * Body:
 * {
 *   templateId: string
 *   title?: string
 *   description?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     draftId: string,
 *     template: ExamTemplate
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // Authentification
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Non authentifié'
                },
                { status: 401 }
            )
        }

        const body: InitializeExamDTO = await request.json()

        // Validation
        if (!body.templateId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le templateId est requis'
                },
                { status: 400 }
            )
        }

        // Initialiser le builder
        const result = await ExamServiceV4.initialize(body, session.user.id)

        return NextResponse.json({
            success: true,
            data: result
        }, { status: 201 })
    } catch (error: any) {

        if (error.message.includes('Template introuvable')) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message
                },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erreur lors de l\'initialisation de l\'examen'
            },
            { status: 500 }
        )
    }
}
