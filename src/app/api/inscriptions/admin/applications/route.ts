import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { SchoolApplicationController } from '@/lib/controllers/SchoolApplicationController'

/**
 * GET /api/inscriptions/admin/applications — Candidatures recues (admin ecole).
 * Query params: formId (requis), page, limit, status
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return SchoolApplicationController.adminListApplications(req, session.user as { id: string; role?: string; schools?: string[] })
}
