import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { SchoolRepository } from '@/lib/repositories/SchoolRepository'
import { UserRole } from '@/models/enums'

const PLATFORM_ADMIN_ROLES: string[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * GET /api/admin/schools/[id]
 * Get a single school's basic details.
 * Access: platform admins only.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !PLATFORM_ADMIN_ROLES.includes(session.user.role as string)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const { id } = await params
    const repo = new SchoolRepository()
    const school = await repo.findByIdBasic(id)

    if (!school) {
        return NextResponse.json({ success: false, message: 'École introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: school })
}
