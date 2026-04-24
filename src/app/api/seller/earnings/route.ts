import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { InvoiceType } from '@/models/enums'

/**
 * GET /api/seller/earnings
 * Historique des relevés de gains (EARNINGS_STATEMENT) du vendeur connecté.
 * Alias pratique de GET /api/invoices?type=EARNINGS_STATEMENT
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') ?? '1', 10)
        const limit = parseInt(searchParams.get('limit') ?? '20', 10)

        const result = await InvoiceService.getInvoiceHistory(
            session.user.id as string,
            InvoiceType.EARNINGS_STATEMENT,
            page,
            limit
        )

        return NextResponse.json({ success: true, data: result })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
