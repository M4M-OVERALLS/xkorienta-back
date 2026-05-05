import mongoose, { Schema, Document, Model } from 'mongoose'
import { Currency } from './enums'

export interface IWallet extends Document {
    _id: mongoose.Types.ObjectId
    /** Le vendeur (enseignant) propriétaire du wallet */
    userId: mongoose.Types.ObjectId
    /** Devise principale du wallet */
    currency: Currency
    /** Solde disponible pour un virement immédiat */
    balance: number
    /** Montant total gagné depuis la création */
    totalEarned: number
    /** Montant total versé (virements effectués) */
    totalWithdrawn: number
    lastUpdatedAt: Date
    createdAt: Date
    updatedAt: Date
}

const WalletSchema = new Schema<IWallet>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        currency: { type: String, enum: Object.values(Currency), default: Currency.XAF },
        balance: { type: Number, default: 0, min: 0 },
        totalEarned: { type: Number, default: 0, min: 0 },
        totalWithdrawn: { type: Number, default: 0, min: 0 },
        lastUpdatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
)

WalletSchema.index({ userId: 1 })

const Wallet: Model<IWallet> = mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', WalletSchema)
export default Wallet
