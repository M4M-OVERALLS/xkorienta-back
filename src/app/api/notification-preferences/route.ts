import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationPreferencesController } from '@/lib/controllers/NotificationPreferencesController'
import { AuthenticationError, withErrorHandler } from '@/lib/errors'

/**
 * GET /api/notification-preferences
 * Retourne les préférences de notifications de l'utilisateur connecté.
 * Lazy init : crée une ligne avec les valeurs par défaut si elle n'existe pas encore.
 */
export async function GET(req: Request) {
    return withErrorHandler(async (lang) => {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            throw new AuthenticationError('AUTH_007', lang)
        }

        return NotificationPreferencesController.getPreferences(session.user.id)
    }, req)
}

/**
 * PATCH /api/notification-preferences
 * Met à jour partiellement les préférences (merge profond).
 * Seuls les champs envoyés sont modifiés — les autres restent intacts.
 */
export async function PATCH(req: Request) {
    return withErrorHandler(async (lang) => {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            throw new AuthenticationError('AUTH_007', lang)
        }

        const body = await req.json()
        return NotificationPreferencesController.patchPreferences(body, session.user.id, lang)
    }, req)
}
