import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { invoiceRepository } from '@/lib/repositories/InvoiceRepository'
import { InvoiceType } from '@/models/enums'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/**
 * GET /api/admin/invoices
 * Liste toutes les factures (admin uniquement).
 * Filtres : ?type=&recipientId=&page=&limit=
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') as InvoiceType | null
        const recipientId = searchParams.get('recipientId') ?? undefined
        const paymentReference = searchParams.get('reference') ?? undefined
        const page = parseInt(searchParams.get('page') ?? '1', 10)
        const limit = parseInt(searchParams.get('limit') ?? '20', 10)

        const result = await invoiceRepository.findPaginated({
            type: type ?? undefined,
            recipientId,
            paymentReference,
            page,
            limit,
        })

        return NextResponse.json({ success: true, data: result })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
