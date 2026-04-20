import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { BookService } from '@/lib/services/BookService'
import { BookScope } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

function contentTypeFromKey(fileKey: string): string {
    const ext = path.extname(fileKey).toLowerCase()
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.epub') return 'application/epub+zip'
    return 'application/octet-stream'
}

/** GET /api/books/[id]/download — Download file after access check */
export async function GET(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            // Public anonymous download: only for approved GLOBAL free books.
            const publicBook = await BookService.getPublicBookById(id)
            if (publicBook.scope !== BookScope.GLOBAL || publicBook.price > 0) {
                return NextResponse.json(
                    { success: false, message: 'Login required for this download' },
                    { status: 401 }
                )
            }
        } else {
            const hasAccess = await BookPurchaseService.hasAccess(session.user.id, id)
            if (!hasAccess) {
                return NextResponse.json({ success: false, message: 'Access denied. Purchase the book first.' }, { status: 403 })
            }
        }

        // Increments download count and returns provider-specific URL or key.
        const downloadUrl = await BookService.getDownloadUrl(id)

        // For signed/external URLs (e.g. S3), redirect directly.
        if (/^https?:\/\//i.test(downloadUrl)) {
            return NextResponse.redirect(downloadUrl)
        }

        // Local storage returns a file key; stream from private/books.
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
        const message = (err as Error).message
        if (message === 'Book not found') {
            return NextResponse.json({ success: false, message }, { status: 404 })
        }
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ success: false, message: 'File not found on storage' }, { status: 404 })
        }
        return NextResponse.json({ success: false, message: message || 'Internal server error' }, { status: 500 })
    }
}
