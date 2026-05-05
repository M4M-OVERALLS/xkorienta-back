import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaService } from '@/lib/services/MediaService'
import { UserRole } from '@/models/enums'

/** GET /api/media/admin/pending — médias en attente de validation */
export async function GET(_req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }

        const adminRole = session.user.role as UserRole
        const allowedRoles: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!allowedRoles.includes(adminRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }

        const media = await MediaService.getPendingMedia(adminRole, session.user.schools ?? [])
        return NextResponse.json({ success: true, data: media })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
