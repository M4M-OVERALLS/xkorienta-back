import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'
import { UserRole } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

/** POST /api/media/[id]/archive */
export async function POST(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }

        const adminRole = session.user.role as UserRole
        const allowedRoles: UserRole[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!allowedRoles.includes(adminRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }

        return await MediaController.archiveMedia(id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Interdit') || message.includes('administrateur') ? 403
                     : message.includes('introuvable') ? 404
                     : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}
