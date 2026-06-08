import * as Sentry from '@sentry/nextjs'
import { FCMService } from '@/lib/services/FCMService'
import Notification, { INotification } from '@/models/Notification'
import mongoose from 'mongoose'

type NotificationInput = {
    userId: string | mongoose.Types.ObjectId
    type: string
    title: string
    message: string
    read: boolean
    data?: Record<string, unknown>
}

/**
 * Crée des notifications en base puis déclenche une push FCM par destinataire (best-effort).
 */
export class NotificationDeliveryService {
    static async createManyAndPush(dataArray: NotificationInput[]): Promise<INotification[]> {
        if (dataArray.length === 0) return []

        const notifications = await Notification.insertMany(dataArray)

        for (const notif of notifications) {
            FCMService.sendPushForNotification(notif as INotification).catch((err) =>
                Sentry.captureException(err, { extra: { context: 'FCM push delivery' } })
            )
        }

        return notifications as INotification[]
    }

    static async createAndPush(data: NotificationInput): Promise<INotification> {
        const notification = await Notification.create(data)
        FCMService.sendPushForNotification(notification as INotification).catch((err) =>
            Sentry.captureException(err, { extra: { context: 'FCM push delivery' } })
        )
        return notification as INotification
    }
}
