import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InvoiceService } from '@/lib/services/InvoiceService'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/**
 * GET /api/invoices/:invoiceNumber/html
 * Retourne la facture au format HTML (pour impression / sauvegarde PDF côté client).
 * Content-Type: text/html
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ invoiceNumber: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 })
        }

        const isAdmin = ADMIN_ROLES.includes(session.user.role as string)
        const { invoiceNumber } = await params
        const invoice = await InvoiceService.getByNumber(
            invoiceNumber,
            session.user.id as string,
            isAdmin
        )

        if (!invoice) {
            return new Response('Facture introuvable', { status: 404 })
        }

        const html = InvoiceService.renderHtml(invoice)

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="${invoiceNumber}.html"`,
            },
        })
    } catch (err) {
        return new Response((err as Error).message, { status: 500 })
    }
}
