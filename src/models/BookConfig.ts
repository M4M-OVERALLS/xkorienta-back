import mongoose, { Schema, Document, Model } from 'mongoose'
import { StorageProvider, PaymentProvider } from './enums'

export interface IDiscountRule {
    minLevel: number
    maxLevel: number
    discountPercent: number
}

export interface IBookConfig extends Document {
    _id: mongoose.Types.ObjectId
    commissionRate: number
    storageProvider: StorageProvider
    paymentProvider: PaymentProvider
    discountRules: IDiscountRule[]
    maxFileSizeBytes: number
    createdAt: Date
    updatedAt: Date
}

const DiscountRuleSchema = new Schema<IDiscountRule>(
    {
        minLevel: { type: Number, required: true, min: 0 },
        maxLevel: { type: Number, required: true, min: 0 },
        discountPercent: { type: Number, required: true, min: 0, max: 100 },
    },
    { _id: false }
)

const BookConfigSchema = new Schema<IBookConfig>(
    {
        commissionRate: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 5,
        },
        storageProvider: {
            type: String,
            enum: Object.values(StorageProvider),
            default: StorageProvider.LOCAL,
        },
        paymentProvider: {
            type: String,
            enum: Object.values(PaymentProvider),
            default: PaymentProvider.NOTCHPAY,
        },
        discountRules: {
            type: [DiscountRuleSchema],
            default: [
                { minLevel: 1,  maxLevel: 5,   discountPercent: 0  },
                { minLevel: 6,  maxLevel: 10,  discountPercent: 10 },
                { minLevel: 11, maxLevel: 20,  discountPercent: 20 },
                { minLevel: 21, maxLevel: 999, discountPercent: 30 },
            ],
        },
        maxFileSizeBytes: {
            type: Number,
            required: true,
            default: 50 * 1024 * 1024, // 50 MB
        },
    },
    { timestamps: true }
)

const BookConfig: Model<IBookConfig> =
    mongoose.models.BookConfig ||
    mongoose.model<IBookConfig>('BookConfig', BookConfigSchema)
export default BookConfig
