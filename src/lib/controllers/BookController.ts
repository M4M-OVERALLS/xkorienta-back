import { NextResponse } from 'next/server'
import { BookService } from '@/lib/services/BookService'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { BookScope, DifficultyLevel, UserRole } from '@/models/enums'

export class BookController {
    /** Construit l'URL absolue de l'image de couverture à partir de la clé. */
    private static enrichWithCoverUrl(book: Record<string, unknown>): Record<string, unknown> {
        return {
            ...book,
            coverImageUrl: BookService.buildCoverUrl(book.coverImageKey as string | undefined),
        }
    }

    /** GET /api/books */
    static async getCatalogue(req: Request, session: { user: { id: string; role: string; schools?: string[] } }) {
        const { searchParams } = new URL(req.url)

        const result = await BookService.getCatalogue({
            scope: (searchParams.get('scope') as BookScope) ?? undefined,
            schoolId: searchParams.get('schoolId') ?? undefined,
            format: searchParams.get('format') ?? undefined,
            minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
            maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
            search: searchParams.get('search') ?? undefined,
            page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
            limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
        })

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                books: result.books.map((b) => BookController.enrichWithCoverUrl(b as unknown as Record<string, unknown>)),
            },
        })
    }

    /** GET /api/books/[id] */
    static async getBook(id: string, session: { user: { id: string; role: string } }) {
        const book = await BookService.getBookById(id, session.user.id, session.user.role as UserRole)
        return NextResponse.json({ success: true, data: BookController.enrichWithCoverUrl(book as unknown as Record<string, unknown>) })
    }

    /** GET /api/books/[id] without auth — only APPROVED books */
    static async getPublicBook(id: string) {
        const book = await BookService.getPublicBookById(id)
        return NextResponse.json({ success: true, data: BookController.enrichWithCoverUrl(book as unknown as Record<string, unknown>) })
    }

    /** POST /api/books */
    static async submitBook(req: Request, session: { user: { id: string; schools?: string[] } }) {
        const formData = await req.formData()

        const file = formData.get('file') as File | null
        if (!file) return NextResponse.json({ success: false, message: 'File is required' }, { status: 400 })

        const title = formData.get('title') as string
        const description = formData.get('description') as string
        const price = Number(formData.get('price') ?? 0)
        const currency = (formData.get('currency') as string) ?? 'XAF'
        const scopeRaw = formData.get('scope') as string | null
        const scope =
            scopeRaw && Object.values(BookScope).includes(scopeRaw as BookScope)
                ? (scopeRaw as BookScope)
                : BookScope.GLOBAL
        const schoolIdRaw = (formData.get('schoolId') as string) ?? ''
        const schoolId = schoolIdRaw.trim() || undefined
        const copyrightAccepted = formData.get('copyrightAccepted') === 'true'

        if (!title?.trim()) return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
        if (!description?.trim()) return NextResponse.json({ success: false, message: 'description is required' }, { status: 400 })

        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // Couverture optionnelle (JPEG, PNG, WebP)
        const coverFile = formData.get('cover') as File | null
        let coverBuffer: Buffer | undefined
        let coverOriginalName: string | undefined
        if (coverFile && coverFile.size > 0) {
            const coverMime = coverFile.type
            if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(coverMime)) {
                return NextResponse.json({ success: false, message: 'Cover must be a JPEG, PNG or WebP image' }, { status: 400 })
            }
            if (coverFile.size > 5 * 1024 * 1024) {
                return NextResponse.json({ success: false, message: 'Cover image too large. Maximum 5 MB.' }, { status: 400 })
            }
            coverBuffer = Buffer.from(await coverFile.arrayBuffer())
            coverOriginalName = coverFile.name
        }

        const parseJsonField = (key: string): string[] | undefined => {
            const raw = formData.get(key) as string | null
            if (!raw) return undefined
            try {
                const arr = JSON.parse(raw)
                return Array.isArray(arr) ? arr.filter((v: unknown) => typeof v === 'string' && v.length > 0) : undefined
            } catch {
                return undefined
            }
        }
        const targetLevels = parseJsonField('targetLevels')
        const targetFields = parseJsonField('targetFields')
        const subjects = parseJsonField('targetSubjects')
        const tags = parseJsonField('tags')
        const difficultyRaw = (formData.get('difficulty') as string) ?? undefined
        let difficulty: DifficultyLevel | undefined
        if (difficultyRaw?.trim()) {
            if (!Object.values(DifficultyLevel).includes(difficultyRaw as DifficultyLevel)) {
                return NextResponse.json({ success: false, message: 'difficulty invalide' }, { status: 400 })
            }
            difficulty = difficultyRaw as DifficultyLevel
        }

        const book = await BookService.submitBook({
            title,
            description,
            fileBuffer,
            fileOriginalName: file.name,
            coverBuffer,
            coverOriginalName,
            price,
            currency,
            scope,
            schoolId,
            copyrightAccepted,
            teacherId: session.user.id,
            targetLevels,
            targetFields,
            subjects,
            difficulty,
            tags,
        })

        return NextResponse.json({ success: true, data: book }, { status: 201 })
    }

    /** PUT /api/books/[id] */
    static async updateBook(req: Request, id: string, session: { user: { id: string } }) {
        const body = await req.json() as { title?: string; description?: string; price?: number; currency?: string }

        const book = await BookService.updateBook(id, session.user.id, body)
        return NextResponse.json({ success: true, data: book })
    }

    /** DELETE /api/books/[id] */
    static async deleteBook(id: string, session: { user: { id: string } }) {
        await BookService.deleteBook(id, session.user.id)
        return NextResponse.json({ success: true, message: 'Book deleted' })
    }

    /** GET /api/books/my */
    static async getMyBooks(req: Request, session: { user: { id: string } }) {
        const { searchParams } = new URL(req.url)
        const books = await BookService.getTeacherBooks(
            session.user.id,
            Number(searchParams.get('page') ?? 1),
            Number(searchParams.get('limit') ?? 20)
        )
        return NextResponse.json({ success: true, data: books })
    }

    /** GET /api/books/[id]/access */
    static async getAccess(req: Request, id: string, session: { user: { id: string } }) {
        const hasAccess = await BookPurchaseService.hasAccess(session.user.id, id)
        if (!hasAccess) {
            return NextResponse.json({ success: false, message: 'Access denied. Purchase the book first.' }, { status: 403 })
        }

        const downloadUrl = await BookService.getDownloadUrl(id)
        return NextResponse.json({ success: true, data: { downloadUrl } })
    }

    /** POST /api/books/[id]/purchase */
    static async initiatePurchase(
        req: Request,
        id: string,
        session: { user: { id: string; email: string; gamification?: { level?: number } } }
    ) {
        let body: { callbackUrl?: string; paymentCurrency?: string } = {}
        const raw = await req.text()
        if (raw.trim()) {
            try {
                body = JSON.parse(raw) as { callbackUrl?: string; paymentCurrency?: string }
            } catch {
                return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
            }
        }

        const appBase =
            (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '') ||
            ''
        const callbackUrl =
            body.callbackUrl ?? `${appBase}/bibliotheque/${id}?payment=return`

        const result = await BookPurchaseService.initiatePurchase({
            bookId: id,
            userId: session.user.id,
            userEmail: session.user.email,
            userLevel: session.user.gamification?.level ?? 1,
            callbackUrl,
            paymentCurrency: body.paymentCurrency,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    /** GET /api/books/purchased */
    static async getPurchased(req: Request, session: { user: { id: string } }) {
        const { searchParams } = new URL(req.url)
        const purchases = await BookPurchaseService.getPurchasedBooks(
            session.user.id,
            Number(searchParams.get('page') ?? 1),
            Number(searchParams.get('limit') ?? 20)
        )
        return NextResponse.json({ success: true, data: purchases })
    }
}
