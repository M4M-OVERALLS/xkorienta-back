import { NextResponse } from 'next/server'
import { NotificationDeviceService } from '@/lib/services/NotificationDeviceService'

const VALID_PLATFORMS = new Set(['android', 'ios', 'web'])

export class NotificationDeviceController {
    /**
     * Enregistre un device FCM (POST /api/notification-devices).
     * Idempotent — upsert sur le token.
     */
    static async registerDevice(
        body: unknown,
        userId: string
    ): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Corps de requête invalide' },
                { status: 400 }
            )
        }

        const { token, platform, deviceId } = body as Record<string, unknown>

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Le champ token est requis' },
                { status: 400 }
            )
        }

        if (!platform || typeof platform !== 'string' || !VALID_PLATFORMS.has(platform)) {
            return NextResponse.json(
                { success: false, message: 'Le champ platform doit être android, ios ou web' },
                { status: 400 }
            )
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
     */
    static async unregisterDevice(
        body: unknown,
        userId: string
    ): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Corps de requête invalide' },
                { status: 400 }
            )
        }

        const { token } = body as Record<string, unknown>

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Le champ token est requis' },
                { status: 400 }
            )
        }

        await NotificationDeviceService.unregisterDevice({
            userId,
            token: token.trim(),
        })

        return NextResponse.json({ success: true, message: 'Device removed' })
    }
}
