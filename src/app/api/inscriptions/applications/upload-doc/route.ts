import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import * as Sentry from '@sentry/nextjs'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

function toAbsoluteUrl(relativePath: string): string {
    const rawBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001'
    const apiBase = rawBase.replace(/\/+$/, '')
    return `${apiBase}${relativePath}`
}

/**
 * POST /api/inscriptions/applications/upload-doc
 *
 * Upload un document pour une candidature (acte naissance, diplome, etc.).
 * Stocke le fichier dans public/uploads/inscriptions/
 * Retourne l'URL publique du fichier.
 *
 * Body (multipart/form-data) :
 *  - file : le fichier (PDF, JPG, PNG, max 10MB)
 *  - fieldId : identifiant du document (ex: "acte_naissance")
 *
 * Auth : optionnel (anonymes peuvent uploader avec guestEmail)
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        await connectDB()

        const formData = await req.formData()
        const file = formData.get('file')
        const fieldId = formData.get('fieldId') as string | null

        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, message: 'Fichier manquant' }, { status: 400 })
        }
        if (!fieldId) {
            return NextResponse.json({ success: false, message: 'fieldId manquant' }, { status: 400 })
        }

        const mimeType = file.type.toLowerCase()
        const ext = ALLOWED_MIME[mimeType]
        if (!ext) {
            return NextResponse.json(
                { success: false, message: 'Format non supporte. Utilisez PDF, JPG ou PNG.' },
                { status: 400 },
            )
        }

        if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
            return NextResponse.json(
                { success: false, message: 'Taille invalide. Maximum 10 MB.' },
                { status: 400 },
            )
        }

        // Ecrire le fichier
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = `${fieldId}-${randomUUID().slice(0, 8)}.${ext}`
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'inscriptions')
        await mkdir(uploadsDir, { recursive: true })
        const absolutePath = path.join(uploadsDir, fileName)
        await writeFile(absolutePath, buffer)

        const relativeUrl = `/uploads/inscriptions/${fileName}`
        const publicUrl = toAbsoluteUrl(relativeUrl)

        return NextResponse.json({
            success: true,
            data: {
                fieldId,
                fileUrl: publicUrl,
                fileName: file.name,
                size: file.size,
            },
        }, { status: 201 })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur upload'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
