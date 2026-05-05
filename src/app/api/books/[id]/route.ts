import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BookController } from '@/lib/controllers/BookController'
import { UserRole } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return await BookController.getPublicBook(id)
        }
        return await BookController.getBook(id, session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: message === 'Book not found' ? 404 : 500 })
    }
}

export async function PUT(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        if (session.user.role !== UserRole.TEACHER) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        return await BookController.updateBook(req, id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Forbidden') ? 403 : message.includes('not found') ? 404 : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        if (session.user.role !== UserRole.TEACHER) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
        return await BookController.deleteBook(id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Forbidden') ? 403 : message.includes('not found') ? 404 : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}
