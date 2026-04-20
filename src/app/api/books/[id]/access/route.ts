import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookController } from '@/lib/controllers/BookController'

type Params = { params: Promise<{ id: string }> }

/** GET /api/books/[id]/access — Get download URL (checks access rights) */
export async function GET(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        return await BookController.getAccess(_req, id, session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
