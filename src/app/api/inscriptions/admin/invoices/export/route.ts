import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import * as Sentry from '@sentry/nextjs'
import mongoose from 'mongoose'
import Invoice from '@/models/Invoice'
import SchoolApplication from '@/models/SchoolApplication'
import { TransactionType } from '@/models/enums'
import { isSchoolOrPlatformAdmin } from '@/lib/auth/roles'

/**
 * GET /api/inscriptions/admin/invoices/export
 * Export CSV des factures d'inscription pour une fiche.
 *
 * Query params :
 *  - formId (requis)
 *
 * Retourne : text/csv avec Content-Disposition: attachment
 * Colonnes : N Facture, Candidat, Email, Montant, Commission, Net Recu, Statut, Date
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new Response('Non autorise', { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (!isSchoolOrPlatformAdmin(role)) {
            return new Response('Non autorise', { status: 403 })
        }

        const url = new URL(req.url)
        const formId = url.searchParams.get('formId')
        if (!formId) {
            return new Response('formId requis', { status: 400 })
        }

        await connectDB()

        // Trouver les paymentRefs
        const applications = await SchoolApplication.find(
            { inscriptionFormId: new mongoose.Types.ObjectId(formId), paymentRef: { $exists: true, $ne: null } },
        ).select('paymentRef').lean()

        const paymentRefs = applications.map((a) => a.paymentRef).filter(Boolean) as string[]

        const invoices = await Invoice.find({
            paymentReference: { $in: paymentRefs },
            productType: TransactionType.SCHOOL_INSCRIPTION,
        }).sort({ createdAt: -1 }).lean()

        // Generer CSV
        const header = 'N Facture,Candidat,Email,Montant,Commission,Net Recu,Statut,Date'
        const rows = invoices.map((inv) => {
            const date = new Date(inv.issuedAt).toLocaleDateString('fr-FR')
            return [
                escapeCsv(inv.invoiceNumber),
                escapeCsv(inv.buyerName ?? ''),
                escapeCsv(inv.buyerEmail ?? ''),
                inv.total ?? 0,
                inv.platformCommission ?? 0,
                inv.sellerAmount ?? 0,
                escapeCsv(inv.status),
                escapeCsv(date),
            ].join(',')
        })

        const csv = [header, ...rows].join('\n')
        const filename = `factures_inscription_${formId.slice(-6)}_${new Date().toISOString().slice(0, 10)}.csv`

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error: unknown) {
        Sentry.captureException(error)
        return new Response('Erreur interne', { status: 500 })
    }
}

/** Echappe une valeur pour CSV (guillemets si virgules/guillemets/sauts de ligne). */
function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}
