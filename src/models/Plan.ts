import mongoose, { Schema, Document, Model } from 'mongoose'
import { SubscriptionInterval, Currency } from './enums'

export interface IPlanPrice {
    currency: Currency
    amount: number
    interval: SubscriptionInterval
}

export interface IPlanLimits {
    maxExamsPerMonth?: number
    maxClassesJoined?: number
    downloadBooks: boolean
    prioritySupport: boolean
    aiAssistance: boolean
    offlineAccess: boolean
}

export interface IPlan extends Document {
    _id: mongoose.Types.ObjectId
    code: string
    name: string
    description: string

    prices: IPlanPrice[]
    features: string[]
    limits: IPlanLimits

    isActive: boolean
    sortOrder: number
    isFree: boolean

    createdAt: Date
    updatedAt: Date
}

const PlanPriceSchema = new Schema<IPlanPrice>(
    {
        currency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        interval: {
            type: String,
            required: true,
            enum: Object.values(SubscriptionInterval),
        },
    },
    { _id: false }
)

const PlanLimitsSchema = new Schema<IPlanLimits>(
    {
        maxExamsPerMonth: {
            type: Number,
            min: 0,
        },
        maxClassesJoined: {
            type: Number,
            min: 0,
        },
        downloadBooks: {
            type: Boolean,
            default: false,
        },
        prioritySupport: {
            type: Boolean,
            default: false,
        },
        aiAssistance: {
            type: Boolean,
            default: false,
        },
        offlineAccess: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
)

const PlanSchema = new Schema<IPlan>(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        prices: {
            type: [PlanPriceSchema],
            default: [],
        },
        features: {
            type: [String],
            default: [],
        },
        limits: {
            type: PlanLimitsSchema,
            required: true,
            default: {
                maxExamsPerMonth: 5,
                maxClassesJoined: 2,
                downloadBooks: false,
                prioritySupport: false,
                aiAssistance: false,
                offlineAccess: false,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        isFree: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
)

PlanSchema.index({ isActive: 1, sortOrder: 1 })

const Plan: Model<IPlan> =
    mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema)

export default Plan
