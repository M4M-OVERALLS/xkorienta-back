/**
 * POST /api/ai/syllabus/parse
 *
 * Endpoint pour parser un fichier syllabus (PDF, DOCX, image)
 * et retourner une structure syllabus exploitable par le frontend.
 *
 * - Auth : session NextAuth requise
 * - Role : TEACHER uniquement
 * - Input : multipart/form-data avec champ "file"
 * - Output : { success, data: { title, description, learningObjectives, structure, rawText } }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SyllabusParsingService } from '@/lib/services/SyllabusParsingService'
import { UserRole } from '@/models/enums'
import { rateLimit, createRateLimitResponse } from '@/lib/security/rateLimiter'

/** Rate limiter : 5 parse par minute par utilisateur */
const syllabusParsingLimiter = rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 5,
})

export async function POST(req: Request): Promise<NextResponse> {
    try {
        // 1. Auth check
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        // 2. Role check
        if (session.user.role !== UserRole.TEACHER) {
            return NextResponse.json(
                { success: false, message: 'Forbidden: Teacher role required' },
                { status: 403 }
            )
        }

        // 3. Rate limiting
        const rateLimitResult = syllabusParsingLimiter(session.user.id)
        if (!rateLimitResult.success) {
            return createRateLimitResponse(rateLimitResult.resetTime)
        }

        // 4. Extract file from FormData
        const formData = await req.formData()
        const file = formData.get('file')

        if (!(file instanceof File)) {
            return NextResponse.json(
                { success: false, message: 'Missing required file field' },
                { status: 400 }
            )
        }

        // 5. Parse the file
        const result = await SyllabusParsingService.parseFile(file)

        return NextResponse.json({
            success: true,
            data: result,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'

        console.error('[AI Syllabus Parse] Error:', message)

        // Erreurs de validation fichier → 400
        if (
            message.includes('Unsupported file type') ||
            message.includes('exceeds the 20 MB limit') ||
            message.includes('File is empty') ||
            message.includes('does not match declared type')
        ) {
            return NextResponse.json(
                { success: false, message },
                { status: 400 }
            )
        }

        // Erreur de parsing IA → 422
        if (message.includes('AI could not parse')) {
            return NextResponse.json(
                { success: false, message: 'AI could not parse the document into a valid syllabus structure.' },
                { status: 422 }
            )
        }

        // Autres erreurs → 500
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        )
    }
}
