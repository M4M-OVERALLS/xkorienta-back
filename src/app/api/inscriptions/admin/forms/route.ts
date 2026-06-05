import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { InscriptionFormController } from '@/lib/controllers/InscriptionFormController'

/**
 * GET /api/inscriptions/admin/forms — Fiches de l'ecole de l'admin (paginee + stats).
 * Query params: schoolId (optionnel si une seule ecole), page, limit, status
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return InscriptionFormController.listSchoolForms(req, session.user as { id: string; role?: string; schools?: string[] })
}
