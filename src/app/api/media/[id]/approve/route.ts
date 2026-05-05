import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaService } from '@/lib/services/MediaService'
import { UserRole } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

/** POST /api/media/[id]/approve */
export async function POST(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }

        const adminRole = session.user.role as UserRole
        const allowedRoles: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!allowedRoles.includes(adminRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }

        const media = await MediaService.approveMedia({
            mediaId: id,
            adminId: session.user.id,
            adminRole,
            adminSchoolIds: session.user.schools ?? [],
        })

        return NextResponse.json({ success: true, data: media })
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Interdit') || message.includes('administrateur') ? 403
                     : message.includes('introuvable') ? 404
                     : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}
