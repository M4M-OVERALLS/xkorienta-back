import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PlanController } from '@/lib/controllers/PlanController'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

type Params = { params: Promise<{ id: string }> }

/** PUT /api/admin/plans/:id — Update a plan */
export async function PUT(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await PlanController.update(id, req)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}

/** DELETE /api/admin/plans/:id — Deactivate a plan */
export async function DELETE(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await PlanController.deactivate(id)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
