import mongoose, { Schema, Document, Model } from 'mongoose'

export interface INotificationDevice extends Document {
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    token: string
    platform: 'android' | 'ios' | 'web'
    deviceId?: string
    createdAt: Date
    updatedAt: Date
    lastUsedAt?: Date
}

const NotificationDeviceSchema = new Schema<INotificationDevice>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        token: { type: String, required: true, unique: true },
        platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
        deviceId: { type: String },
        lastUsedAt: { type: Date },
    },
    { timestamps: true }
)

const NotificationDevice: Model<INotificationDevice> =
    mongoose.models.NotificationDevice ||
    mongoose.model<INotificationDevice>('NotificationDevice', NotificationDeviceSchema)

export default NotificationDevice
