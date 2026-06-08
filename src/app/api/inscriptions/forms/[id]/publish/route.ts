import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { InscriptionFormController } from '@/lib/controllers/InscriptionFormController'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return Response.json({ success: false, message: 'Non autorise' }, { status: 401 })
    }
    await connectDB()
    return InscriptionFormController.publishForm(req, session.user as { id: string; role?: string; schools?: string[] }, id)
}
