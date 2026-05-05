import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IGuestPurchase extends Document {
    _id: mongoose.Types.ObjectId
    bookId: mongoose.Types.ObjectId
    email: string
    paymentReference: string
    paymentProvider: string
    status: 'PENDING' | 'COMPLETED' | 'FAILED'
    downloadToken?: string
    downloadTokenExpiry?: Date
    downloadCount: number
    maxDownloads: number
    finalAmount: number
    currency: string
    expiresAt: Date
    /** ID du vendeur (auteur du livre) — rempli à la complétion */
    sellerId?: mongoose.Types.ObjectId
    /** Gains nets versés au vendeur après commission */
    sellerAmount?: number
    /** Commission prélevée par la plateforme */
    platformCommission?: number
    createdAt: Date
    updatedAt: Date
}

const GuestPurchaseSchema = new Schema<IGuestPurchase>(
    {
        bookId:           { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
        email:            { type: String, required: true, lowercase: true, trim: true, index: true },
        paymentReference: { type: String, required: true, unique: true, index: true },
        paymentProvider:  { type: String, required: true },
        status: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED'],
            default: 'PENDING',
            index: true,
        },
        downloadToken:        { type: String, index: true, sparse: true },
        downloadTokenExpiry:  { type: Date },
        downloadCount:        { type: Number, default: 0, min: 0 },
        maxDownloads:         { type: Number, default: 3 },
        finalAmount:          { type: Number, required: true, min: 0 },
        currency:             { type: String, required: true, uppercase: true, trim: true },
        expiresAt:            { type: Date, required: true, index: true },
        sellerId:             { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
        sellerAmount:         { type: Number },
        platformCommission:   { type: Number },
    },
    { timestamps: true }
)

GuestPurchaseSchema.index({ email: 1, bookId: 1 })
GuestPurchaseSchema.index({ status: 1, expiresAt: 1 })

const GuestPurchase: Model<IGuestPurchase> =
    mongoose.models.GuestPurchase ||
    mongoose.model<IGuestPurchase>('GuestPurchase', GuestPurchaseSchema)

export default GuestPurchase
