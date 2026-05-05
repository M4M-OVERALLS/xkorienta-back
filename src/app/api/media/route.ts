import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'
import { UserRole } from '@/models/enums'

/** GET /api/media — catalogue authentifié */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        return await MediaController.getCatalogue(req, session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}

/** POST /api/media — soumettre un média (TEACHER uniquement) */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        if (session.user.role !== UserRole.TEACHER) {
            return NextResponse.json(
                { success: false, message: 'Seuls les enseignants peuvent soumettre des médias' },
                { status: 403 }
            )
        }
        return await MediaController.submitMedia(req, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('volumineux') ? 413
                     : message.includes('invalide') ? 400
                     : message.includes('requis') ? 400
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
