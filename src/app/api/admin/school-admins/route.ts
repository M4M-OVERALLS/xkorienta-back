import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { SchoolAdminManagementService } from '@/lib/services/SchoolAdminManagementService'
import { UserRole } from '@/models/enums'

const ADMIN_ROLES = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * GET /api/admin/school-admins?schoolId=xxx
 * Lister les admins d'une ecole.
 *
 * POST /api/admin/school-admins
 * Creer un admin ecole + le rattacher + envoyer email.
 * Body: { name, email, schoolId }
 */

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (!role || !ADMIN_ROLES.includes(role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
        }

        const url = new URL(req.url)
        const schoolId = url.searchParams.get('schoolId')
        if (!schoolId) {
            return NextResponse.json({ success: false, message: 'schoolId requis' }, { status: 400 })
        }

        await connectDB()
        const result = await SchoolAdminManagementService.listSchoolAdmins(schoolId)
        return NextResponse.json({ success: true, data: result })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}

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
        const { name, email, schoolId } = body as { name?: string; email?: string; schoolId?: string }

        if (!name || !email || !schoolId) {
            return NextResponse.json(
                { success: false, message: 'name, email et schoolId sont requis' },
                { status: 400 },
            )
        }

        await connectDB()
        const result = await SchoolAdminManagementService.createSchoolAdmin({
            name,
            email,
            schoolId,
            createdBy: session.user.id as string,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    } catch (error: unknown) {
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        const status = message.includes('existe deja') ? 409 : 500
        return NextResponse.json({ success: false, message }, { status })
    }
}
