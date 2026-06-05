import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { InscriptionFormController } from '@/lib/controllers/InscriptionFormController'

/**
 * GET  /api/inscriptions/forms — Liste publique des fiches publiees (paginee)
 * POST /api/inscriptions/forms — Creer une fiche (admin ecole)
 */

export async function GET(req: Request) {
    await connectDB()
    return InscriptionFormController.listPublished(req)
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return InscriptionFormController.createForm(req, session.user as { id: string; role?: string; schools?: string[] })
}
