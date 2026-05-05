import mongoose, { Schema, Document, Model } from 'mongoose'
import { InvoiceType, InvoiceStatus, TransactionType } from './enums'

export interface IInvoice extends Document {
    _id: mongoose.Types.ObjectId
    invoiceNumber: string
    type: InvoiceType
    /** Null pour les factures acheteur invité (pas de compte) */
    recipientId?: mongoose.Types.ObjectId
    /** Null pour les achats invités (pas de Transaction document) */
    transactionId?: mongoose.Types.ObjectId
    /** Référence de la GuestPurchase pour les achats invités */
    guestPurchaseId?: mongoose.Types.ObjectId
    /** Vrai pour les achats sans compte */
    isGuestPurchase?: boolean
    paymentReference: string
    productType: TransactionType
    productDescription: string
    subtotal: number
    discountAmount: number
    discountPercent: number
    total: number
    currency: string
    platformCommission?: number
    sellerAmount?: number
    buyerName: string
    buyerEmail?: string
    sellerName?: string
    status: InvoiceStatus
    issuedAt: Date
    sentAt?: Date
    createdAt: Date
    updatedAt: Date
}

const InvoiceSchema = new Schema<IInvoice>(
    {
        invoiceNumber:    { type: String, required: true, unique: true },
        type:             { type: String, enum: Object.values(InvoiceType), required: true },
        recipientId:      { type: Schema.Types.ObjectId, ref: 'User' },
        transactionId:    { type: Schema.Types.ObjectId, ref: 'Transaction' },
        guestPurchaseId:  { type: Schema.Types.ObjectId, ref: 'GuestPurchase' },
        isGuestPurchase:  { type: Boolean, default: false },
        paymentReference: { type: String, required: true },
        productType:      { type: String, enum: Object.values(TransactionType), required: true },
        productDescription: { type: String, required: true },
        subtotal:         { type: Number, required: true },
        discountAmount:   { type: Number, default: 0 },
        discountPercent:  { type: Number, default: 0 },
        total:            { type: Number, required: true },
        currency:         { type: String, required: true },
        platformCommission: { type: Number },
        sellerAmount:     { type: Number },
        buyerName:        { type: String, required: true },
        buyerEmail:       { type: String },
        sellerName:       { type: String },
        status:    { type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.ISSUED },
        issuedAt:  { type: Date, required: true },
        sentAt:    { type: Date },
    },
    { timestamps: true }
)

InvoiceSchema.index({ recipientId: 1, createdAt: -1 }, { sparse: true })
InvoiceSchema.index({ paymentReference: 1 })
InvoiceSchema.index({ type: 1, recipientId: 1 }, { sparse: true })
InvoiceSchema.index({ guestPurchaseId: 1 }, { sparse: true })

// In dev, force re-registration so schema changes (removed required fields, new fields)
// are picked up without restarting. In production the cache is stable across requests.
if (process.env.NODE_ENV === 'development' && mongoose.models.Invoice) {
    mongoose.deleteModel('Invoice')
}

const Invoice: Model<IInvoice> =
    (mongoose.models.Invoice as Model<IInvoice>) ||
    mongoose.model<IInvoice>('Invoice', InvoiceSchema)
export default Invoice
