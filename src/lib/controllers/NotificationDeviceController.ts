import { NextResponse } from 'next/server'
import { NotificationDeviceService } from '@/lib/services/NotificationDeviceService'
import { NotificationError } from '@/lib/errors/core/NotificationError'
import { SupportedLanguage } from '@/lib/errors/core/types'

const VALID_PLATFORMS = new Set(['android', 'ios', 'web'])

export class NotificationDeviceController {
    /**
     * Enregistre un device FCM (POST /api/notification-devices).
     * Idempotent — upsert sur le token.
     *
     * @throws {NotificationError} NOTIF_003 si le body est invalide
     * @throws {NotificationError} NOTIF_001 si le token est manquant ou vide
     * @throws {NotificationError} NOTIF_002 si la platform est invalide
     */
    static async registerDevice(
        body: unknown,
        userId: string,
        language: SupportedLanguage = 'fr'
    ): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            throw NotificationError.invalidBody(language)
        }

        const { token, platform, deviceId } = body as Record<string, unknown>

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            throw NotificationError.tokenRequired(language)
        }

        if (!platform || typeof platform !== 'string' || !VALID_PLATFORMS.has(platform)) {
            throw NotificationError.invalidPlatform(String(platform ?? ''), language)
        }

        await NotificationDeviceService.registerDevice({
            userId,
            token: token.trim(),
            platform: platform as 'android' | 'ios' | 'web',
            deviceId: typeof deviceId === 'string' ? deviceId.trim() : undefined,
        })

        return NextResponse.json({ success: true, message: 'Device registered' })
    }

    /**
     * Supprime un device FCM (DELETE /api/notification-devices).
     * Appelé avant le signout — la session est encore valide.
     *
     * @throws {NotificationError} NOTIF_003 si le body est invalide
     * @throws {NotificationError} NOTIF_001 si le token est manquant ou vide
     */
    static async unregisterDevice(
        body: unknown,
        userId: string,
        language: SupportedLanguage = 'fr'
    ): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            throw NotificationError.invalidBody(language)
        }

        const { token } = body as Record<string, unknown>

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            throw NotificationError.tokenRequired(language)
        }

        await NotificationDeviceService.unregisterDevice({
            userId,
            token: token.trim(),
        })

        return NextResponse.json({ success: true, message: 'Device removed' })
    }
}
