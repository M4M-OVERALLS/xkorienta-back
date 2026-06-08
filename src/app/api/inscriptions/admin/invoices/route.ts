import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import mongoose from 'mongoose'
import Invoice from '@/models/Invoice'
import SchoolApplication from '@/models/SchoolApplication'
import { TransactionType } from '@/models/enums'
import { isSchoolOrPlatformAdmin } from '@/lib/auth/roles'

/**
 * GET /api/inscriptions/admin/invoices
 * Factures liees aux candidatures d'une fiche d'inscription.
 *
 * Query params :
 *  - formId (requis) : ID de la fiche
 *  - page, limit : pagination
 *  - status : filtre par InvoiceStatus
 *
 * L'admin ecole voit : montant brut, commission plateforme, net recu.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (!isSchoolOrPlatformAdmin(role)) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
        }

        const url = new URL(req.url)
        const formId = url.searchParams.get('formId')
        if (!formId) {
            return NextResponse.json({ success: false, message: 'formId requis' }, { status: 400 })
        }

        const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
        const skip = (page - 1) * limit
        const status = url.searchParams.get('status') ?? undefined

        await connectDB()

        // Trouver les paymentRefs des candidatures de cette fiche
        const applications = await SchoolApplication.find(
            { inscriptionFormId: new mongoose.Types.ObjectId(formId), paymentRef: { $exists: true, $ne: null } },
        ).select('paymentRef').lean()

        const paymentRefs = applications.map((a) => a.paymentRef).filter(Boolean) as string[]
        if (paymentRefs.length === 0) {
            return NextResponse.json({
                success: true,
                data: { invoices: [], total: 0, page, limit, totalPages: 0, stats: { totalAmount: 0, totalCommission: 0, totalNet: 0 } },
            })
        }

        // Chercher les factures par paymentRef
        const query: Record<string, unknown> = {
            paymentReference: { $in: paymentRefs },
            productType: TransactionType.SCHOOL_INSCRIPTION,
        }
        if (status) query.status = status

        const [invoices, total] = await Promise.all([
            Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Invoice.countDocuments(query),
        ])

        // Stats financieres
        const allInvoices = await Invoice.find({
            paymentReference: { $in: paymentRefs },
            productType: TransactionType.SCHOOL_INSCRIPTION,
        }).select('total platformCommission sellerAmount').lean()

        const stats = allInvoices.reduce(
            (acc, inv) => ({
                totalAmount: acc.totalAmount + (inv.total ?? 0),
                totalCommission: acc.totalCommission + (inv.platformCommission ?? 0),
                totalNet: acc.totalNet + (inv.sellerAmount ?? 0),
            }),
            { totalAmount: 0, totalCommission: 0, totalNet: 0 },
        )

        return NextResponse.json({
            success: true,
            data: {
                invoices,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                stats,
            },
        })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
