import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'
import { UserRole } from '@/models/enums'

type Params = { params: Promise<{ id: string }> }

/** GET /api/media/[id] */
export async function GET(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return await MediaController.getPublicMedia(id)
        }
        return await MediaController.getMedia(id, session as any)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json(
            { success: false, message },
            { status: message.includes('introuvable') ? 404 : 500 }
        )
    }
}

/** PUT /api/media/[id] */
export async function PUT(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        if (session.user.role !== UserRole.TEACHER) return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        return await MediaController.updateMedia(req, id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Interdit') ? 403 : message.includes('introuvable') ? 404 : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}

/** DELETE /api/media/[id] */
export async function DELETE(_req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        if (session.user.role !== UserRole.TEACHER) return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        return await MediaController.deleteMedia(id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('Interdit') ? 403 : message.includes('introuvable') ? 404 : 400
        return NextResponse.json({ success: false, message }, { status })
    }
}
