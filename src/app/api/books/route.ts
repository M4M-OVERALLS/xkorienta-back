import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookController } from '@/lib/controllers/BookController'
import { UserRole } from '@/models/enums'

/** GET /api/books — Public catalogue (approved books) */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        return await BookController.getCatalogue(req, session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}

/** POST /api/books — Submit a book (TEACHER only) */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        if (session.user.role !== UserRole.TEACHER) {
            return NextResponse.json({ success: false, message: 'Only teachers can submit books' }, { status: 403 })
        }
        return await BookController.submitBook(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('File too large') ? 413
                     : message.includes('Invalid file type') ? 400
                     : message.includes('required') ? 400
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
