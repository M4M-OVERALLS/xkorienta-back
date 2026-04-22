import mongoose, { Schema, Document, Model } from 'mongoose'
import { BookPurchaseStatus } from './enums'

export interface IBookPurchase extends Document {
    _id: mongoose.Types.ObjectId
    bookId: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    originalPrice: number
    discountPercent: number
    finalAmount: number
    currency: string
    paymentReference: string
    paymentProvider: string
    status: BookPurchaseStatus
    teacherAmount: number
    platformCommission: number
    createdAt: Date
    updatedAt: Date
}

const BookPurchaseSchema = new Schema<IBookPurchase>(
    {
        bookId: {
            type: Schema.Types.ObjectId,
            ref: 'Book',
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
            enum: Object.values(BookPurchaseStatus),
            default: BookPurchaseStatus.PENDING,
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

BookPurchaseSchema.index({ userId: 1, bookId: 1 }, { unique: true })
BookPurchaseSchema.index({ paymentReference: 1 }, { unique: true })
BookPurchaseSchema.index({ userId: 1, status: 1 })
BookPurchaseSchema.index({ bookId: 1, status: 1 })

const BookPurchase: Model<IBookPurchase> =
    mongoose.models.BookPurchase ||
    mongoose.model<IBookPurchase>('BookPurchase', BookPurchaseSchema)
export default BookPurchase
