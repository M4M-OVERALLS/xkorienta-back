import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Invoice, { IInvoice } from '@/models/Invoice'
import { InvoiceType } from '@/models/enums'

export interface InvoiceFilters {
    recipientId?: string
    type?: InvoiceType
    paymentReference?: string
    page?: number
    limit?: number
}

export interface PaginatedInvoices {
    invoices: IInvoice[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export class InvoiceRepository {
    /**
     * Génère le prochain numéro de facture séquentiel : INV-YYYY-XXXXXX
     */
    async generateInvoiceNumber(): Promise<string> {
        await connectDB()
        const year = new Date().getFullYear()
        const prefix = `INV-${year}-`
        const lastInvoice = await Invoice.findOne(
            { invoiceNumber: { $regex: `^${prefix}` } },
            { invoiceNumber: 1 }
        ).sort({ invoiceNumber: -1 }).lean()

        let nextSeq = 1
        if (lastInvoice) {
            const parts = lastInvoice.invoiceNumber.split('-')
            nextSeq = parseInt(parts[2] ?? '0', 10) + 1
        }
        return `${prefix}${String(nextSeq).padStart(6, '0')}`
    }

    async create(data: Partial<IInvoice>): Promise<IInvoice> {
        await connectDB()
        return Invoice.create(data)
    }

    async findByInvoiceNumber(invoiceNumber: string): Promise<IInvoice | null> {
        await connectDB()
        return Invoice.findOne({ invoiceNumber }).lean() as Promise<IInvoice | null>
    }

    async findByPaymentReference(reference: string): Promise<IInvoice[]> {
        await connectDB()
        return Invoice.find({ paymentReference: reference }).lean() as Promise<IInvoice[]>
    }

    async findPaginated(filters: InvoiceFilters): Promise<PaginatedInvoices> {
        await connectDB()

        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {}
        if (filters.recipientId) {
            query.recipientId = new mongoose.Types.ObjectId(filters.recipientId)
        }
        if (filters.type) {
            query.type = filters.type
        }
        if (filters.paymentReference) {
            query.paymentReference = filters.paymentReference
        }

        const [invoices, total] = await Promise.all([
            Invoice.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean() as Promise<IInvoice[]>,
            Invoice.countDocuments(query),
        ])

        return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    async markAsSent(invoiceNumber: string): Promise<void> {
        await connectDB()
        await Invoice.updateOne(
            { invoiceNumber },
            { $set: { status: 'SENT', sentAt: new Date() } }
        )
    }

    async void(invoiceNumber: string): Promise<void> {
        await connectDB()
        await Invoice.updateOne({ invoiceNumber }, { $set: { status: 'VOIDED' } })
    }
}

export const invoiceRepository = new InvoiceRepository()
