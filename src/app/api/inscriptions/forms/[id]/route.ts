import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { InscriptionFormController } from '@/lib/controllers/InscriptionFormController'

/**
 * GET /api/inscriptions/forms/:id — Detail d'une fiche (public)
 * PUT /api/inscriptions/forms/:id — Modifier une fiche (admin ecole, brouillon)
 */

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
    const { id } = await params
    await connectDB()
    return InscriptionFormController.getDetail(req, id)
}

export async function PUT(req: Request, { params }: RouteParams) {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return InscriptionFormController.updateForm(req, session.user as { id: string; role?: string; schools?: string[] }, id)
}
