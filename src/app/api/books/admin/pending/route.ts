import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookAdminController } from '@/lib/controllers/BookAdminController'
import { UserRole } from '@/models/enums'

/** GET /api/books/admin/pending — Pending books queue for admins */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

        const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!adminRoles.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await BookAdminController.getPending(session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
