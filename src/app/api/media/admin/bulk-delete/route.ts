import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'
import { UserRole } from '@/models/enums'

/** DELETE /api/media/admin/bulk-delete */
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }

        const adminRole = session.user.role as UserRole
        const allowedRoles: UserRole[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!allowedRoles.includes(adminRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }

        return await MediaController.adminBulkDeleteMedia(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Interdit') || message.includes('administrateur') ? 403
                     : message.includes('Maximum') || message.includes('Aucun') ? 400
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
