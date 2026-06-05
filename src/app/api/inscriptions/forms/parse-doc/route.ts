import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { InscriptionFormParsingService } from '@/lib/services/InscriptionFormParsingService'
import { UserRole } from '@/models/enums'

/**
 * POST /api/inscriptions/forms/parse-doc
 * Upload un document (PDF/DOCX/image) et parse via Claude
 * pour pre-remplir les champs d'une fiche d'inscription.
 *
 * Auth : SCHOOL_ADMIN ou PLATFORM_ADMIN requis
 * Body : multipart/form-data avec champ "file"
 * Response : { formFields[], domainGroups[], docsRequired[], price?, title? }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (role !== UserRole.SCHOOL_ADMIN && role !== UserRole.PLATFORM_ADMIN) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ success: false, message: 'Fichier requis' }, { status: 400 })
        }

        const result = await InscriptionFormParsingService.parseDocument(file)

        return NextResponse.json({ success: true, data: result })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur lors du parsing'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
