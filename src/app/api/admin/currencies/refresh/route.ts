import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CurrencyController } from '@/lib/controllers/CurrencyController'

const ADMIN_ROLES = ['DG_M4M', 'TECH_SUPPORT']

/** POST /api/admin/currencies/refresh — Refresh exchange rates */
export async function POST() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        if (!ADMIN_ROLES.includes(session.user.role as string)) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }

        return await CurrencyController.refreshRates()
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
