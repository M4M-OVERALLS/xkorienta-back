import { NextResponse } from 'next/server'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { BookStatus, BookScope } from '@/models/enums'

/**
 * GET /api/books/public
 * Public endpoint — no authentication required.
 * Returns approved books only (free and paid), paginated.
 * Used by the public library page on the landing site.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)

        const result = await bookRepository.findPaginated({
            status: BookStatus.APPROVED,
            scope: BookScope.GLOBAL,
            format: searchParams.get('format') ?? undefined,
            minPrice: searchParams.get('free') === '1' ? 0 : undefined,
            maxPrice: searchParams.get('free') === '1' ? 0 : undefined,
            search: searchParams.get('search') ?? undefined,
            page: Number(searchParams.get('page') ?? 1),
            limit: Math.min(Number(searchParams.get('limit') ?? 24), 50),
        })

        return NextResponse.json({ success: true, data: result })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message },
            { status: 500 }
        )
    }
}
