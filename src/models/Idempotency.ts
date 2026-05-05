import mongoose, { Schema, Document, Model } from 'mongoose'

export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface IIdempotency extends Document {
    key: string
    requestFingerprint: string
    status: IdempotencyStatus
    responsePayload?: Record<string, unknown>
    errorPayload?: { code: string; message: string }
    createdAt: Date
    expiresAt: Date
}

const IdempotencySchema = new Schema<IIdempotency>(
    {
        key: { type: String, required: true, unique: true, index: true },
        requestFingerprint: { type: String, required: true },
        status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], required: true },
        responsePayload: { type: Schema.Types.Mixed },
        errorPayload: { type: Schema.Types.Mixed },
        expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    },
    { timestamps: true }
)

const Idempotency: Model<IIdempotency> =
    mongoose.models.Idempotency || mongoose.model<IIdempotency>('Idempotency', IdempotencySchema)

export default Idempotency
