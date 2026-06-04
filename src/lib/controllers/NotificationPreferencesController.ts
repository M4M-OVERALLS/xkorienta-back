import { NextResponse } from 'next/server'
import { NotificationPreferencesService } from '@/lib/services/NotificationPreferencesService'
import { NotificationError } from '@/lib/errors/core/NotificationError'
import { SupportedLanguage } from '@/lib/errors/core/types'

export class NotificationPreferencesController {
    /**
     * Retourne les préférences de l'utilisateur connecté (GET).
     * Lazy init : crée avec les défauts si aucune ligne n'existe.
     */
    static async getPreferences(userId: string): Promise<NextResponse> {
        const prefs = await NotificationPreferencesService.getOrCreate(userId)

        return NextResponse.json({
            success: true,
            data: {
                channels: prefs.channels,
                types: prefs.types,
                quietHours: prefs.quietHours,
            },
        })
    }

    /**
     * Met à jour partiellement les préférences (PATCH).
     * Seuls les champs envoyés dans le body sont modifiés.
     *
     * @throws {NotificationError} NOTIF_003 si le body est invalide
     * @throws {NotificationError} NOTIF_006 si aucune section n'est fournie
     * @throws {NotificationError} NOTIF_004 si le format HH:mm est invalide
     * @throws {NotificationError} NOTIF_005 si la timezone IANA est invalide
     */
    static async patchPreferences(
        body: unknown,
        userId: string,
        language: SupportedLanguage = 'fr'
    ): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            throw NotificationError.invalidBody(language)
        }

        const { channels, types, quietHours } = body as Record<string, unknown>

        if (channels === undefined && types === undefined && quietHours === undefined) {
            throw NotificationError.noFieldProvided(language)
        }

        if (channels !== undefined && typeof channels !== 'object') {
            throw NotificationError.invalidBody(language)
        }
        if (types !== undefined && typeof types !== 'object') {
            throw NotificationError.invalidBody(language)
        }
        if (quietHours !== undefined && typeof quietHours !== 'object') {
            throw NotificationError.invalidBody(language)
        }

        const updated = await NotificationPreferencesService.patch(
            userId,
            { channels: channels as any, types: types as any, quietHours: quietHours as any },
            language
        )

        return NextResponse.json({
            success: true,
            message: language === 'en' ? 'Preferences updated' : 'Préférences mises à jour',
            data: {
                channels: updated.channels,
                types: updated.types,
                quietHours: updated.quietHours,
            },
        })
    }
}
