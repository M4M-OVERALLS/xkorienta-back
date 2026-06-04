import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import * as Sentry from '@sentry/nextjs'
import { authOptions } from '@/lib/auth'
import { NotificationPreferencesController } from '@/lib/controllers/NotificationPreferencesController'

/**
 * GET /api/notification-preferences
 * Retourne les préférences de notifications de l'utilisateur connecté.
 * Lazy init : crée une ligne avec les valeurs par défaut si elle n'existe pas encore.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        return NotificationPreferencesController.getPreferences(session.user.id)
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/notification-preferences
 * Met à jour partiellement les préférences (merge profond).
 * Seuls les champs envoyés sont modifiés — les autres restent intacts.
 */
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        return NotificationPreferencesController.patchPreferences(body, session.user.id)
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
