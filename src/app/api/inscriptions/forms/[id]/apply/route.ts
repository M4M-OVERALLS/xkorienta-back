import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { SchoolApplicationController } from '@/lib/controllers/SchoolApplicationController'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/inscriptions/forms/:id/apply — Soumettre une candidature.
 * Accepte les utilisateurs connectes ET anonymes (guestEmail dans le body).
 */
export async function POST(req: Request, { params }: RouteParams) {
    const { id } = await params
    const session = await getServerSession(authOptions)
    await connectDB()

    const user = session?.user?.id
        ? (session.user as { id: string; role?: string; schools?: string[] })
        : undefined

    return SchoolApplicationController.apply(req, id, user)
}
