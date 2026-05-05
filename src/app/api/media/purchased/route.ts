import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'

/** GET /api/media/purchased — médias achetés par l'utilisateur connecté */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        return await MediaController.getPurchased(req, session as any)
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
