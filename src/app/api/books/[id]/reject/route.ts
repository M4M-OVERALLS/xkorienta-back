import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookAdminController } from '@/lib/controllers/BookAdminController'
import { UserRole } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

/** POST /api/books/[id]/reject */
export async function POST(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

        const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]
        if (!adminRoles.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await BookAdminController.reject(req, id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Forbidden') || message.includes('Only') ? 403
                     : message.includes('not found') ? 404
                     : message.includes('required') ? 400
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
