import mongoose, { Schema, Document, Model } from 'mongoose'
import { PayoutStatus, MobileMoneyProvider, Currency } from './enums'

export interface IPayout extends Document {
    _id: mongoose.Types.ObjectId
    /** Le vendeur qui demande le virement */
    userId: mongoose.Types.ObjectId
    walletId: mongoose.Types.ObjectId
    /** Montant demandé */
    amount: number
    currency: Currency
    /** Informations du destinataire Mobile Money */
    recipientPhone: string
    recipientName: string
    recipientProvider: MobileMoneyProvider
    status: PayoutStatus
    /** Référence unique du virement (pour NotchPay) */
    payoutReference: string
    paymentProvider: string
    /** Référence retournée par NotchPay après traitement */
    providerTransferId?: string
    processedAt?: Date
    failureReason?: string
    createdAt: Date
    updatedAt: Date
}

const PayoutSchema = new Schema<IPayout>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
        amount: { type: Number, required: true, min: 1 },
        currency: { type: String, enum: Object.values(Currency), required: true },
        recipientPhone: { type: String, required: true },
        recipientName: { type: String, required: true },
        recipientProvider: { type: String, enum: Object.values(MobileMoneyProvider), required: true },
        status: { type: String, enum: Object.values(PayoutStatus), default: PayoutStatus.PENDING },
        payoutReference: { type: String, required: true, unique: true },
        paymentProvider: { type: String, default: 'notchpay' },
        providerTransferId: { type: String },
        processedAt: { type: Date },
        failureReason: { type: String },
    },
    { timestamps: true }
)

PayoutSchema.index({ userId: 1, createdAt: -1 })
PayoutSchema.index({ status: 1 })

const Payout: Model<IPayout> = mongoose.models.Payout || mongoose.model<IPayout>('Payout', PayoutSchema)
export default Payout
