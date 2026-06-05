import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { SchoolApplicationController } from '@/lib/controllers/SchoolApplicationController'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PATCH /api/inscriptions/admin/applications/:id — Approuver/rejeter une candidature.
 * Body: { status: "APPROVED" | "REJECTED", reviewNote?: string }
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return SchoolApplicationController.adminUpdateApplication(req, session.user as { id: string; role?: string; schools?: string[] }, id)
}
