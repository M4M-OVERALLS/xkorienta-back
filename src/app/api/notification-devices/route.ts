import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import * as Sentry from '@sentry/nextjs'
import { authOptions } from '@/lib/auth'
import { NotificationDeviceController } from '@/lib/controllers/NotificationDeviceController'

/**
 * POST /api/notification-devices
 * Enregistre ou rafraîchit un device FCM pour l'utilisateur connecté.
 * Idempotent — upsert sur le token.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        return NotificationDeviceController.registerDevice(body, session.user.id)
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/notification-devices
 * Supprime un device FCM au logout.
 * Doit être appelé AVANT le signout (la session doit encore être valide).
 */
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        return NotificationDeviceController.unregisterDevice(body, session.user.id)
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
