import mongoose, { Schema, Document, Model } from 'mongoose'

/** Catégories sémantiques utilisées pour le filtrage des préférences push. */
export type NotificationCategory =
    | 'exam_result'
    | 'exam_pending'
    | 'new_message'
    | 'forum_reply'
    | 'assistance_response'
    | 'rewards'
    | 'account'

export interface INotification extends Document {
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    type: 'badge' | 'xp' | 'level_up' | 'achievement' | 'info' | 'exam' | 'class' | 'alert' | 'success'
    /** Catégorie sémantique pour le filtrage push par préférence utilisateur. */
    category?: NotificationCategory
    title: string
    message: string
    read: boolean
    data?: any
    createdAt: Date
    updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: {
            type: String,
            enum: ['badge', 'xp', 'level_up', 'achievement', 'info', 'exam', 'class', 'alert', 'success'],
            required: true
        },
        category: {
            type: String,
            enum: ['exam_result', 'exam_pending', 'new_message', 'forum_reply', 'assistance_response', 'rewards', 'account'],
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        read: { type: Boolean, default: false, index: true },
        data: { type: Schema.Types.Mixed }
    },
    { timestamps: true }
)

// Indexes pour optimiser les requêtes
NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ userId: 1, read: 1 })

const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification
