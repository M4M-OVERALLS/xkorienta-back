import { NextResponse } from 'next/server'
import {
    NotificationPreferencesService,
    PreferencesValidationError,
} from '@/lib/services/NotificationPreferencesService'

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
     */
    static async patchPreferences(body: unknown, userId: string): Promise<NextResponse> {
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Corps de requête invalide' },
                { status: 400 }
            )
        }

        const { channels, types, quietHours } = body as Record<string, unknown>

        if (channels === undefined && types === undefined && quietHours === undefined) {
            return NextResponse.json(
                { success: false, message: 'Au moins un champ est requis : channels, types ou quietHours' },
                { status: 400 }
            )
        }

        // Validation de structure minimale pour éviter les injections de champs parasites
        if (channels !== undefined && typeof channels !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Le champ channels doit être un objet' },
                { status: 400 }
            )
        }
        if (types !== undefined && typeof types !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Le champ types doit être un objet' },
                { status: 400 }
            )
        }
        if (quietHours !== undefined && typeof quietHours !== 'object') {
            return NextResponse.json(
                { success: false, message: 'Le champ quietHours doit être un objet' },
                { status: 400 }
            )
        }

        try {
            const updated = await NotificationPreferencesService.patch(userId, {
                channels: channels as any,
                types: types as any,
                quietHours: quietHours as any,
            })

            return NextResponse.json({
                success: true,
                message: 'Préférences mises à jour',
                data: {
                    channels: updated.channels,
                    types: updated.types,
                    quietHours: updated.quietHours,
                },
            })
        } catch (error) {
            if (error instanceof PreferencesValidationError) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 400 }
                )
            }
            throw error
        }
    }
}
