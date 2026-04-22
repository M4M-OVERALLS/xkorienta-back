import { NextResponse } from 'next/server'
import { BookService } from '@/lib/services/BookService'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { BookScope, UserRole } from '@/models/enums'

export class BookController {
    /** GET /api/books */
    static async getCatalogue(req: Request, session: { user: { id: string; role: string; schools?: string[] } }) {
        const { searchParams } = new URL(req.url)

        const books = await BookService.getCatalogue({
            scope: (searchParams.get('scope') as BookScope) ?? undefined,
            schoolId: searchParams.get('schoolId') ?? undefined,
            format: searchParams.get('format') ?? undefined,
            minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
            maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
            search: searchParams.get('search') ?? undefined,
            page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
            limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
        })

        return NextResponse.json({ success: true, data: books })
    }

    /** GET /api/books/[id] */
    static async getBook(id: string, session: { user: { id: string; role: string } }) {
        const book = await BookService.getBookById(id, session.user.id, session.user.role as UserRole)
        return NextResponse.json({ success: true, data: book })
    }

    /** GET /api/books/[id] without auth — only APPROVED books */
    static async getPublicBook(id: string) {
        const book = await BookService.getPublicBookById(id)
        return NextResponse.json({ success: true, data: book })
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
        const scope = (formData.get('scope') as BookScope) ?? BookScope.GLOBAL
        const schoolId = (formData.get('schoolId') as string) ?? undefined
        const copyrightAccepted = formData.get('copyrightAccepted') === 'true'

        if (!title?.trim()) return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
        if (!description?.trim()) return NextResponse.json({ success: false, message: 'description is required' }, { status: 400 })

        const fileBuffer = Buffer.from(await file.arrayBuffer())

        const book = await BookService.submitBook({
            title,
            description,
            fileBuffer,
            fileOriginalName: file.name,
            price,
            currency,
            scope,
            schoolId,
            copyrightAccepted,
            teacherId: session.user.id,
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
