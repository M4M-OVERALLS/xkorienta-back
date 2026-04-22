import { NextResponse } from 'next/server'
import { PlanController } from '@/lib/controllers/PlanController'

type Params = { params: Promise<{ code: string }> }

/** GET /api/plans/:code — Get plan details */
export async function GET(req: Request, { params }: Params) {
    try {
        const { code } = await params
        return await PlanController.getByCode(code)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
