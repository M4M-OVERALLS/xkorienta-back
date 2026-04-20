import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookAdminController } from '@/lib/controllers/BookAdminController'
import { UserRole } from '@/models/enums'

/** GET /api/admin/books/config */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        if (session.user.role !== UserRole.DG_M4M && session.user.role !== UserRole.TECH_SUPPORT) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }
        return await BookAdminController.getConfig()
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}

/** PUT /api/admin/books/config */
export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        if (session.user.role !== UserRole.DG_M4M && session.user.role !== UserRole.TECH_SUPPORT) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }
        return await BookAdminController.updateConfig(req)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: message.includes('must be') ? 422 : 500 })
    }
}
