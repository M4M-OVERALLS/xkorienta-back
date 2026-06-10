import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { GuestBookPurchaseService } from '@/lib/services/GuestBookPurchaseService'
import { BookService } from '@/lib/services/BookService'

function contentTypeFromKey(fileKey: string): string {
    const ext = path.extname(fileKey).toLowerCase()
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.epub') return 'application/epub+zip'
    return 'application/octet-stream'
}

/**
 * GET /api/books/guest-download?token=xxx
 * Serves a book file for a guest buyer who received a download link by email.
 * The token is validated (exists, not expired, download count < max).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Token manquant' },
                { status: 400 }
            )
        }

        const result = await GuestBookPurchaseService.validateDownloadToken(token)
        if (!result) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Lien invalide, expiré ou nombre maximum de téléchargements atteint.',
                },
                { status: 403 }
            )
        }

        const { bookId, guestPurchaseId } = result

        // Increment before serving to prevent concurrent race (best-effort)
        await GuestBookPurchaseService.incrementDownload(guestPurchaseId)

        const downloadUrl = await BookService.getDownloadUrl(bookId)

        if (/^https?:\/\//i.test(downloadUrl)) {
            return NextResponse.redirect(downloadUrl)
        }

        // Local storage — stream the file
        const absolutePath = path.join(process.cwd(), 'private', 'books', downloadUrl)
        const fileBuffer = await fs.readFile(absolutePath)

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentTypeFromKey(downloadUrl),
                'Content-Disposition': `attachment; filename="${path.basename(downloadUrl)}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 })
        }
        return NextResponse.json(
            { success: false, message: (err as Error).message || 'Erreur interne' },
            { status: 500 }
        )
    }
}
