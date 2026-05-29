import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'
import { UserRole } from '@/models/enums'

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/** GET /api/media/admin/all — liste paginée de tous les médias (admin) */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }
        return await MediaController.getAdminMediaList(req)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
