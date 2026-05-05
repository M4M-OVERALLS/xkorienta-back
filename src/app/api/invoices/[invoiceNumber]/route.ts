import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InvoiceService } from '@/lib/services/InvoiceService'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/**
 * GET /api/invoices/:invoiceNumber
 * Retourne les détails d'une facture.
 * Accessible uniquement par le destinataire ou un admin.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ invoiceNumber: string }> }
) {
    try {
        const { invoiceNumber } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const isAdmin = ADMIN_ROLES.includes(session.user.role as string)
        const { invoiceNumber } = await params
        const invoice = await InvoiceService.getByNumber(
            invoiceNumber,
            session.user.id as string,
            isAdmin
        )

        if (!invoice) {
            return NextResponse.json({ success: false, message: 'Facture introuvable' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: invoice })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
