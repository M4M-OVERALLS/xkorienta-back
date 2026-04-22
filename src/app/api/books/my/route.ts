import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookController } from '@/lib/controllers/BookController'
import { UserRole } from '@/models/enums'

/** GET /api/books/my — Teacher's own submitted books */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.SCHOOL_ADMIN) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        }
        return await BookController.getMyBooks(req, session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
