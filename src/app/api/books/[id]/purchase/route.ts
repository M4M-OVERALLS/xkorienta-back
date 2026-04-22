import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookController } from '@/lib/controllers/BookController'

type Params = { params: Promise<{ id: string }> }

/** POST /api/books/[id]/purchase — Initiate a purchase */
export async function POST(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        return await BookController.initiatePurchase(req, id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('already purchased') ? 409
                     : message.includes('not available') ? 400
                     : message.includes('not found') ? 404
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
