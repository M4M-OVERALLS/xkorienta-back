import mongoose, { Schema, Document, Model } from 'mongoose'
import { Currency } from './enums'

export interface IExchangeRate extends Document {
    _id: mongoose.Types.ObjectId
    baseCurrency: string
    targetCurrency: string
    rate: number
    inverseRate: number
    source: string
    fetchedAt: Date
    expiresAt: Date
}

const ExchangeRateSchema = new Schema<IExchangeRate>(
    {
        baseCurrency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
            trim: true,
        },
        targetCurrency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
            trim: true,
        },
        rate: {
            type: Number,
            required: true,
            min: 0,
        },
        inverseRate: {
            type: Number,
            required: true,
            min: 0,
        },
        source: {
            type: String,
            required: true,
            trim: true,
            default: 'exchangerate-api.com',
        },
        fetchedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    { timestamps: false }
)

// Unique constraint: one rate per currency pair
ExchangeRateSchema.index({ baseCurrency: 1, targetCurrency: 1 }, { unique: true })

// TTL index to automatically remove expired rates (optional cleanup)
ExchangeRateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })

const ExchangeRate: Model<IExchangeRate> =
    mongoose.models.ExchangeRate ||
    mongoose.model<IExchangeRate>('ExchangeRate', ExchangeRateSchema)

export default ExchangeRate
