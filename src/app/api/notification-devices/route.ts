import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationDeviceController } from '@/lib/controllers/NotificationDeviceController'
import { AuthenticationError, withErrorHandler } from '@/lib/errors'

/**
 * POST /api/notification-devices
 * Enregistre ou rafraîchit un device FCM pour l'utilisateur connecté (upsert sur le token).
 */
export async function POST(req: Request) {
    return withErrorHandler(async (lang) => {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            throw new AuthenticationError('AUTH_007', lang)
        }

        const body = await req.json()
        return NotificationDeviceController.registerDevice(body, session.user.id, lang)
    }, req)
}

/**
 * DELETE /api/notification-devices
 * Supprime un device FCM au logout.
 * Doit être appelé AVANT le signout (la session doit encore être valide).
 */
export async function DELETE(req: Request) {
    return withErrorHandler(async (lang) => {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            throw new AuthenticationError('AUTH_007', lang)
        }

        const body = await req.json()
        return NotificationDeviceController.unregisterDevice(body, session.user.id, lang)
    }, req)
}
