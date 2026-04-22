import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PlanController } from '@/lib/controllers/PlanController'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/** POST /api/admin/plans — Create a new plan */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await PlanController.create(req)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('already exists') ? 409 : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
