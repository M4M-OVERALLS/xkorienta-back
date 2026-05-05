import mongoose, { Schema, Document, Model } from 'mongoose'
import { TransactionType, TransactionStatus, Currency, PaymentProvider } from './enums'

export interface IStatusHistoryEntry {
    status: TransactionStatus
    at: Date
    reason?: string
}

export interface ITransaction extends Document {
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    type: TransactionType
    productId: mongoose.Types.ObjectId
    productModel: string

    // Amounts
    originalAmount: number
    originalCurrency: string
    convertedAmount: number
    paymentCurrency: string
    exchangeRate: number
    discountPercent: number
    finalAmount: number

    // Commissions
    platformCommission: number
    sellerAmount: number
    sellerId?: mongoose.Types.ObjectId

    // Payment
    paymentReference: string
    paymentProvider: string
    providerTransactionId?: string

    status: TransactionStatus
    statusHistory: IStatusHistoryEntry[]

    // Metadata
    metadata: Record<string, unknown>
    webhookReceivedAt?: Date
    completedAt?: Date
    expiresAt: Date

    createdAt: Date
    updatedAt: Date
}

const StatusHistorySchema = new Schema<IStatusHistoryEntry>(
    {
        status: {
            type: String,
            enum: Object.values(TransactionStatus),
            required: true,
        },
        at: {
            type: Date,
            required: true,
            default: Date.now,
        },
        reason: {
            type: String,
            trim: true,
        },
    },
    { _id: false }
)

const TransactionSchema = new Schema<ITransaction>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(TransactionType),
            required: true,
            index: true,
        },
        productId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'productModel',
        },
        productModel: {
            type: String,
            required: true,
            enum: ['Book', 'Media', 'Plan', 'Course'],
        },

        // Amounts
        originalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        originalCurrency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
            trim: true,
        },
        convertedAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentCurrency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
            trim: true,
        },
        exchangeRate: {
            type: Number,
            required: true,
            min: 0,
            default: 1,
        },
        discountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0,
        },
        finalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        // Commissions
        platformCommission: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        sellerAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        sellerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },

        // Payment
        paymentReference: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        paymentProvider: {
            type: String,
            required: true,
            enum: Object.values(PaymentProvider),
            trim: true,
        },
        providerTransactionId: {
            type: String,
            trim: true,
        },

        status: {
            type: String,
            enum: Object.values(TransactionStatus),
            default: TransactionStatus.PENDING,
            index: true,
        },
        statusHistory: {
            type: [StatusHistorySchema],
            default: [],
        },

        // Metadata
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
        webhookReceivedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    { timestamps: true }
)

// Compound indexes for common queries
TransactionSchema.index({ userId: 1, status: 1 })
TransactionSchema.index({ userId: 1, type: 1 })
TransactionSchema.index({ productId: 1, productModel: 1 })
TransactionSchema.index({ status: 1, expiresAt: 1 })
TransactionSchema.index({ createdAt: -1 })

// Pre-save hook to add status to history
TransactionSchema.pre('save', function () {
    if (this.isNew) {
        this.statusHistory.push({
            status: this.status,
            at: new Date(),
        })
    }
})

const Transaction: Model<ITransaction> =
    mongoose.models.Transaction ||
    mongoose.model<ITransaction>('Transaction', TransactionSchema)

export default Transaction
