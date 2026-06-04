import NotificationDevice, { INotificationDevice } from '@/models/NotificationDevice'
import { INotification } from '@/models/Notification'
import { NotificationPreferencesService } from '@/lib/services/NotificationPreferencesService'
import connectDB from '@/lib/mongodb'
import logger from '@/lib/utils/logger'

/**
 * Codes d'erreur FCM indiquant un token définitivement invalide.
 * Les erreurs temporaires (server-unavailable, internal-error) sont intentionnellement exclues.
 */
const PERMANENT_INVALID_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
])

/**
 * Résout la route de navigation deep-link depuis une notification.
 * Le backend est la source de vérité du mapping type → route.
 */
function resolveRouteFromNotification(notification: INotification): string {
    const data = notification.data ?? {}

    switch (notification.type) {
        case 'exam':
            if (data.attemptId && data.examId) return `/exam/${data.examId}/result`
            if (data.examId) return `/exam/${data.examId}/pending`
            return '/notifications'

        case 'info':
            if (data.examId) return `/exam/${data.examId}`
            if (data.syllabusId) return `/syllabus/${data.syllabusId}`
            if (data.conversationId) return `/messaging/chat/${data.conversationId}`
            if (data.forumId) return `/messaging/forum/${data.forumId}`
            return '/notifications'

        case 'success':
            if (data.examId && data.attemptId) return `/exam/${data.examId}/result`
            if (data.examId) return `/exam/${data.examId}`
            return '/notifications'

        case 'alert':
            if (data.examId) return `/exam/${data.examId}`
            return '/notifications'

        case 'badge':
            return '/profile/badges'

        case 'xp':
        case 'level_up':
        case 'achievement':
            return '/profile'

        default:
            return '/notifications'
    }
}

/**
 * Sérialise toutes les valeurs en string pour FCM.
 * FCM rejette les nombres, booléens et objets imbriqués dans le champ data.
 */
function flattenDataForFcm(data: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(data ?? {})) {
        if (value === null || value === undefined) continue
        result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
    return result
}

/**
 * Supprime de la base les tokens FCM définitivement invalides
 * retournés par Firebase après un envoi multicast.
 */
async function cleanupInvalidTokens(
    devices: INotificationDevice[],
    responses: Array<{ success: boolean; error?: { code?: string } }>
): Promise<void> {
    const tokensToDelete: string[] = []

    responses.forEach((res, i) => {
        if (!res.success && PERMANENT_INVALID_TOKEN_CODES.has(res.error?.code ?? '')) {
            tokensToDelete.push(devices[i].token)
        }
    })

    if (tokensToDelete.length > 0) {
        await NotificationDevice.deleteMany({ token: { $in: tokensToDelete } })
        logger.info(`[FCMService] ${tokensToDelete.length} token(s) invalide(s) supprimé(s)`)
    }
}

export class FCMService {
    /**
     * Envoie une push notification FCM à tous les devices enregistrés de l'utilisateur.
     * L'envoi est best-effort : les erreurs sont loggées sans propager l'exception.
     */
    static async sendPushForNotification(notification: INotification): Promise<void> {
        try {
            await connectDB()

            const devices = await NotificationDevice.find({ userId: notification.userId }).lean()
            if (devices.length === 0) return

            // Gate préférences — la notif in-app est déjà créée, seule la push est filtrée
            const canSend = await NotificationPreferencesService.canSendPush(
                String(notification.userId),
                notification.type
            )
            if (!canSend) {
                logger.info(
                    `[FCMService] Push filtrée par préférences pour userId=${notification.userId} type=${notification.type}`
                )
                return
            }

            let firebaseApp: ReturnType<typeof import('firebase-admin').app>
            try {
                const { getFirebaseAdmin } = await import('@/lib/firebase')
                firebaseApp = getFirebaseAdmin()
            } catch (err) {
                logger.warn('[FCMService] Firebase non initialisé, push ignorée:', err)
                return
            }

            const route = resolveRouteFromNotification(notification)

            const fcmPayload = {
                tokens: devices.map((d) => d.token),
                notification: {
                    title: notification.title,
                    body: notification.message,
                },
                data: {
                    notificationId: String(notification._id),
                    type: notification.type,
                    route,
                    ...flattenDataForFcm(notification.data ?? {}),
                },
                android: {
                    notification: { channel_id: 'xkorienta_default_channel' },
                },
                apns: {
                    payload: { aps: { sound: 'default' } },
                },
            }

            const response = await firebaseApp.messaging().sendEachForMulticast(fcmPayload)

            await cleanupInvalidTokens(
                devices as INotificationDevice[],
                response.responses.map((r) => ({
                    success: r.success,
                    error: r.error ? { code: (r.error as any).code } : undefined,
                }))
            )

            const successfulTokens = devices
                .filter((_, i) => response.responses[i].success)
                .map((d) => d.token)

            if (successfulTokens.length > 0) {
                await NotificationDevice.updateMany(
                    { token: { $in: successfulTokens } },
                    { $set: { lastUsedAt: new Date() } }
                )
            }

            logger.info(
                `[FCMService] Push envoyée à userId=${notification.userId}: ` +
                `${response.successCount}/${devices.length} device(s) atteint(s)`
            )
        } catch (error) {
            logger.error('[FCMService] Erreur lors de l\'envoi de la push notification:', error)
        }
    }
}
