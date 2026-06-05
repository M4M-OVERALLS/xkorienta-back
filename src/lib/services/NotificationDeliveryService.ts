import { FCMService } from '@/lib/services/FCMService'
import logger from '@/lib/utils/logger'
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
                logger.error('[NotificationDeliveryService] FCM push échouée:', err)
            )
        }

        return notifications as INotification[]
    }

    static async createAndPush(data: NotificationInput): Promise<INotification> {
        const notification = await Notification.create(data)
        FCMService.sendPushForNotification(notification as INotification).catch((err) =>
            logger.error('[NotificationDeliveryService] FCM push échouée:', err)
        )
        return notification as INotification
    }
}
