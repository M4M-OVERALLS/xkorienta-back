import mongoose from 'mongoose'
import NotificationDevice from '@/models/NotificationDevice'
import connectDB from '@/lib/mongodb'

export class NotificationDeviceService {
    /**
     * Enregistre ou rafraîchit un device FCM pour un utilisateur.
     * Effectue un upsert sur le token : si le token existe déjà, met à jour les métadonnées
     * (dont le userId, au cas où l'appareil aurait changé de propriétaire).
     */
    static async registerDevice(params: {
        userId: string
        token: string
        platform: 'android' | 'ios' | 'web'
        deviceId?: string
    }): Promise<void> {
        await connectDB()

        const { userId, token, platform, deviceId } = params
        const now = new Date()

        const existing = await NotificationDevice.findOne({ token })

        if (existing) {
            existing.userId = new mongoose.Types.ObjectId(userId)
            existing.platform = platform
            existing.deviceId = deviceId
            existing.updatedAt = now
            existing.lastUsedAt = now
            await existing.save()
        } else {
            await NotificationDevice.create({
                userId: new mongoose.Types.ObjectId(userId),
                token,
                platform,
                deviceId,
                lastUsedAt: now,
            })
        }
    }

    /**
     * Supprime le device FCM d'un utilisateur (appelé au logout).
     * Filtre sur userId ET token pour empêcher la suppression du token d'un autre utilisateur.
     */
    static async unregisterDevice(params: { userId: string; token: string }): Promise<void> {
        await connectDB()

        await NotificationDevice.deleteOne({
            userId: new mongoose.Types.ObjectId(params.userId),
            token: params.token,
        })
    }
}
