import mongoose, { Schema, Document, Model } from 'mongoose'
import { InvoiceType, InvoiceStatus, TransactionType } from './enums'

export interface IInvoice extends Document {
    _id: mongoose.Types.ObjectId
    /** Numéro séquentiel lisible : INV-2026-000001 */
    invoiceNumber: string
    /** PURCHASE_RECEIPT (acheteur) ou EARNINGS_STATEMENT (vendeur) */
    type: InvoiceType
    /** Utilisateur destinataire de la facture */
    recipientId: mongoose.Types.ObjectId
    /** Référence vers la transaction source */
    transactionId: mongoose.Types.ObjectId
    paymentReference: string
    /** Type de produit acheté */
    productType: TransactionType
    /** Description lisible du produit */
    productDescription: string
    /** Données financières */
    subtotal: number
    discountAmount: number
    discountPercent: number
    total: number
    currency: string
    /** Uniquement rempli pour EARNINGS_STATEMENT */
    platformCommission?: number
    sellerAmount?: number
    /** Snapshot des infos de l'acheteur au moment de la transaction */
    buyerName: string
    buyerEmail?: string
    /** Snapshot des infos du vendeur (si applicable) */
    sellerName?: string
    status: InvoiceStatus
    issuedAt: Date
    sentAt?: Date
    createdAt: Date
    updatedAt: Date
}

const InvoiceSchema = new Schema<IInvoice>(
    {
        invoiceNumber: { type: String, required: true, unique: true },
        type: { type: String, enum: Object.values(InvoiceType), required: true },
        recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
        paymentReference: { type: String, required: true },
        productType: { type: String, enum: Object.values(TransactionType), required: true },
        productDescription: { type: String, required: true },
        subtotal: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        total: { type: Number, required: true },
        currency: { type: String, required: true },
        platformCommission: { type: Number },
        sellerAmount: { type: Number },
        buyerName: { type: String, required: true },
        buyerEmail: { type: String },
        sellerName: { type: String },
        status: { type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.ISSUED },
        issuedAt: { type: Date, required: true },
        sentAt: { type: Date },
    },
    { timestamps: true }
)

InvoiceSchema.index({ recipientId: 1, createdAt: -1 })
InvoiceSchema.index({ paymentReference: 1 })
InvoiceSchema.index({ type: 1, recipientId: 1 })

const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema)
export default Invoice
