import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/**
 * GET /api/invoices/:invoiceNumber/html
 * Retourne la facture au format HTML (pour impression / sauvegarde PDF côté client).
 * Content-Type: text/html
 *
 * Accès invité : fournir ?token=<downloadToken> (depuis l'email de téléchargement).
 * Accès utilisateur connecté : session NextAuth requise.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ invoiceNumber: string }> }
) {
    try {
        const { invoiceNumber } = await params
        const url = new URL(req.url)
        const token = url.searchParams.get('token')

        // ── Accès invité via download token ─────────────────────────────────
        if (token) {
            const guestPurchase = await guestPurchaseRepository.findByToken(token)
            if (!guestPurchase) {
                return new Response('Token invalide ou expiré', { status: 403 })
            }

            const invoice = await InvoiceService.getByGuestToken(
                invoiceNumber,
                guestPurchase._id.toString()
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
        }

        // ── Accès utilisateur authentifié ────────────────────────────────────
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 })
        }

        const isAdmin = ADMIN_ROLES.includes(session.user.role as string)
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
