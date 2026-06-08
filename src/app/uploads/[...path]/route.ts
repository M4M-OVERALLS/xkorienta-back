import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { readPublicUpload } from '@/lib/uploads/servePublicUpload'

type RouteParams = { params: Promise<{ path: string[] }> }

/**
 * GET /uploads/*
 *
 * Sert les fichiers uploades a l'execution (avatars, inscriptions, covers…).
 * En mode standalone, Next.js n'expose que les fichiers public/ presents au build ;
 * cette route comble le trou pour les uploads runtime.
 */
export async function GET(_req: Request, { params }: RouteParams) {
    try {
        const { path: segments } = await params
        const file = await readPublicUpload(segments ?? [])

        if (!file) {
            return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 })
        }

        return new NextResponse(new Uint8Array(file.buffer), {
            status: 200,
            headers: {
                'Content-Type': file.contentType,
                'Content-Disposition': `inline; filename="${file.fileName}"`,
                'Cache-Control': 'public, max-age=86400',
            },
        })
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 })
        }

        Sentry.captureException(error)
        return NextResponse.json({ success: false, message: 'Erreur interne' }, { status: 500 })
    }
}
