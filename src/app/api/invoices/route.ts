import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { InvoiceType } from '@/models/enums'

/**
 * GET /api/invoices
 * Retourne l'historique des factures de l'utilisateur connecté.
 * - Filtre optionnel ?type=PURCHASE_RECEIPT|EARNINGS_STATEMENT
 * - Pagination : ?page=1&limit=20
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') as InvoiceType | null
        const page = parseInt(searchParams.get('page') ?? '1', 10)
        const limit = parseInt(searchParams.get('limit') ?? '20', 10)

        if (type && !Object.values(InvoiceType).includes(type)) {
            return NextResponse.json(
                { success: false, message: `Type invalide. Valeurs acceptées : ${Object.values(InvoiceType).join(', ')}` },
                { status: 400 }
            )
        }

        const result = await InvoiceService.getInvoiceHistory(
            session.user.id as string,
            type ?? undefined,
            page,
            limit
        )

        return NextResponse.json({ success: true, data: result })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
