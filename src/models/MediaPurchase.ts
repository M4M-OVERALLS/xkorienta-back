import mongoose, { Schema, Document, Model } from 'mongoose'
import { MediaPurchaseStatus } from './enums'

export interface IMediaPurchase extends Document {
    _id: mongoose.Types.ObjectId
    mediaId: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    originalPrice: number
    discountPercent: number
    finalAmount: number
    currency: string
    paymentReference: string
    paymentProvider: string
    status: MediaPurchaseStatus
    teacherAmount: number
    platformCommission: number
    createdAt: Date
    updatedAt: Date
}

const MediaPurchaseSchema = new Schema<IMediaPurchase>(
    {
        mediaId: {
            type: Schema.Types.ObjectId,
            ref: 'Media',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        originalPrice: {
            type: Number,
            required: true,
            min: 0,
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
        currency: {
            type: String,
            required: true,
            default: 'XAF',
            trim: true,
            uppercase: true,
        },
        paymentReference: {
            type: String,
            required: true,
            trim: true,
        },
        paymentProvider: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(MediaPurchaseStatus),
            default: MediaPurchaseStatus.PENDING,
        },
        teacherAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        platformCommission: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { timestamps: true }
)

MediaPurchaseSchema.index({ userId: 1, mediaId: 1 }, { unique: true })
MediaPurchaseSchema.index({ paymentReference: 1 }, { unique: true })
MediaPurchaseSchema.index({ userId: 1, status: 1 })
MediaPurchaseSchema.index({ mediaId: 1, status: 1 })

const MediaPurchase: Model<IMediaPurchase> =
    mongoose.models.MediaPurchase ||
    mongoose.model<IMediaPurchase>('MediaPurchase', MediaPurchaseSchema)

export default MediaPurchase
