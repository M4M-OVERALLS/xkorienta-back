import mongoose, { Schema, Document, Model } from 'mongoose'
import { SubscriptionInterval, SubscriptionPlanStatus, Currency } from './enums'

export interface IRenewalReminder {
    sentAt: Date
    type: 'EMAIL' | 'PUSH' | 'SMS'
}

export interface ISubscription extends Document {
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    planId: mongoose.Types.ObjectId

    status: SubscriptionPlanStatus
    interval: SubscriptionInterval

    currentPeriodStart: Date
    currentPeriodEnd: Date
    cancelledAt?: Date

    // Payment info
    lastTransactionId?: mongoose.Types.ObjectId
    currency: string
    amount: number

    autoRenew: boolean
    renewalReminders: IRenewalReminder[]

    createdAt: Date
    updatedAt: Date
}

const RenewalReminderSchema = new Schema<IRenewalReminder>(
    {
        sentAt: {
            type: Date,
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['EMAIL', 'PUSH', 'SMS'],
        },
    },
    { _id: false }
)

const SubscriptionSchema = new Schema<ISubscription>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        planId: {
            type: Schema.Types.ObjectId,
            ref: 'Plan',
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(SubscriptionPlanStatus),
            default: SubscriptionPlanStatus.ACTIVE,
            index: true,
        },
        interval: {
            type: String,
            enum: Object.values(SubscriptionInterval),
            required: true,
        },
        currentPeriodStart: {
            type: Date,
            required: true,
        },
        currentPeriodEnd: {
            type: Date,
            required: true,
            index: true,
        },
        cancelledAt: {
            type: Date,
        },

        // Payment info
        lastTransactionId: {
            type: Schema.Types.ObjectId,
            ref: 'Transaction',
        },
        currency: {
            type: String,
            required: true,
            enum: Object.values(Currency),
            uppercase: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        autoRenew: {
            type: Boolean,
            default: true,
        },
        renewalReminders: {
            type: [RenewalReminderSchema],
            default: [],
        },
    },
    { timestamps: true }
)

// One active subscription per user
SubscriptionSchema.index(
    { userId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'ACTIVE' },
    }
)

SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 })
SubscriptionSchema.index({ userId: 1, createdAt: -1 })

const Subscription: Model<ISubscription> =
    mongoose.models.Subscription ||
    mongoose.model<ISubscription>('Subscription', SubscriptionSchema)

export default Subscription
