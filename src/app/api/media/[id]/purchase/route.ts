import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaController } from '@/lib/controllers/MediaController'

type Params = { params: Promise<{ id: string }> }

/** POST /api/media/[id]/purchase — initier un paiement */
export async function POST(req: Request, { params }: Params) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        return await MediaController.initiatePurchase(req, id, session as any)
    } catch (err) {
        const message = (err as Error).message
        const status = message.includes('déjà') ? 409
                     : message.includes('gratuit') ? 400
                     : message.includes('introuvable') ? 404
                     : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
