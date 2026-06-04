import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IChannels {
    push: boolean
    email: boolean
}

export interface ITypePrefs {
    exam_result: boolean
    exam_pending: boolean
    new_message: boolean
    forum_reply: boolean
    assistance_response: boolean
    rewards: boolean
    account: boolean
}

export interface IQuietHours {
    enabled: boolean
    /** Format HH:mm 24h */
    start: string
    /** Format HH:mm 24h */
    end: string
    /** IANA timezone — ex: "Africa/Douala" */
    timezone: string
}

export interface INotificationPreferences extends Document {
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    channels: IChannels
    types: ITypePrefs
    quietHours: IQuietHours
    createdAt: Date
    updatedAt: Date
}

const ChannelsSchema = new Schema<IChannels>(
    {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
    },
    { _id: false }
)

const TypesSchema = new Schema<ITypePrefs>(
    {
        exam_result: { type: Boolean, default: true },
        exam_pending: { type: Boolean, default: true },
        new_message: { type: Boolean, default: true },
        forum_reply: { type: Boolean, default: true },
        assistance_response: { type: Boolean, default: true },
        rewards: { type: Boolean, default: true },
        account: { type: Boolean, default: true },
    },
    { _id: false }
)

const QuietHoursSchema = new Schema<IQuietHours>(
    {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' },
        end: { type: String, default: '06:00' },
        timezone: { type: String, default: 'Africa/Douala' },
    },
    { _id: false }
)

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        channels: { type: ChannelsSchema, default: () => ({}) },
        types: { type: TypesSchema, default: () => ({}) },
        quietHours: { type: QuietHoursSchema, default: () => ({}) },
    },
    { timestamps: true }
)

const NotificationPreferences: Model<INotificationPreferences> =
    mongoose.models.NotificationPreferences ||
    mongoose.model<INotificationPreferences>(
        'NotificationPreferences',
        NotificationPreferencesSchema
    )

export default NotificationPreferences
