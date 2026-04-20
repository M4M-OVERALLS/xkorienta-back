import { NextResponse } from 'next/server'
import { BookService } from '@/lib/services/BookService'
import { BookConfigService } from '@/lib/services/BookConfigService'
import { BookPurchaseService } from '@/lib/services/BookPurchaseService'
import { UserRole } from '@/models/enums'

export class BookAdminController {
    /** GET /api/books/admin/pending */
    static async getPending(session: { user: { id: string; role: string; schools?: string[] } }) {
        const books = await BookService.getPendingBooks(
            session.user.role as UserRole,
            session.user.schools ?? []
        )
        return NextResponse.json({ success: true, data: books })
    }

    /** POST /api/books/[id]/approve */
    static async approve(id: string, session: { user: { id: string; role: string; schools?: string[] } }) {
        const book = await BookService.approveBook({
            bookId: id,
            adminId: session.user.id,
            adminRole: session.user.role as UserRole,
            adminSchoolIds: session.user.schools ?? [],
        })
        return NextResponse.json({ success: true, data: book })
    }

    /** POST /api/books/[id]/reject */
    static async reject(req: Request, id: string, session: { user: { id: string; role: string; schools?: string[] } }) {
        const body = await req.json() as { comment?: string }

        if (!body.comment?.trim()) {
            return NextResponse.json({ success: false, message: 'comment is required' }, { status: 400 })
        }

        const book = await BookService.rejectBook({
            bookId: id,
            adminId: session.user.id,
            adminRole: session.user.role as UserRole,
            adminSchoolIds: session.user.schools ?? [],
            comment: body.comment,
        })
        return NextResponse.json({ success: true, data: book })
    }

    /** GET /api/admin/books/config */
    static async getConfig() {
        const config = await BookConfigService.getConfig()
        return NextResponse.json({ success: true, data: config })
    }

    /** PUT /api/admin/books/config */
    static async updateConfig(req: Request) {
        const body = await req.json()
        const config = await BookConfigService.updateConfig(body)
        return NextResponse.json({ success: true, data: config })
    }

    /** POST /api/books/purchase/webhook — no auth required */
    static async handleWebhook(req: Request) {
        const rawBody = await req.text()
        const signature = req.headers.get('x-notchpay-signature') ?? ''

        await BookPurchaseService.handleWebhook(rawBody, signature)
        return NextResponse.json({ success: true })
    }
}
