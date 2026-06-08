import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { SchoolAdminManagementService } from '@/lib/services/SchoolAdminManagementService'
import { UserRole } from '@/models/enums'

const ADMIN_ROLES = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * POST /api/admin/school-admins/invite-link
 * Generer (ou recuperer) un lien d'invitation SCHOOL_ADMIN pour une ecole.
 * Body: { schoolId }
 * Response: { link, token, expiresAt }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (!role || !ADMIN_ROLES.includes(role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
        }

        const body = await req.json()
        const schoolId = body.schoolId as string
        if (!schoolId) {
            return NextResponse.json({ success: false, message: 'schoolId requis' }, { status: 400 })
        }

        await connectDB()
        const result = await SchoolAdminManagementService.getOrCreateInvitationLink(
            schoolId,
            session.user.id as string,
        )

        return NextResponse.json({ success: true, data: result })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
