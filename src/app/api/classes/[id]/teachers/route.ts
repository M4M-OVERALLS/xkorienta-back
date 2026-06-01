import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import * as Sentry from '@sentry/nextjs'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { ClassTeacherService } from '@/lib/services/ClassTeacherService'
import { ClassTeacherRole, ClassTeacherPermission, UserRole } from '@/models/enums'
import Class from '@/models/Class'

const ADMIN_ROLES: string[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT, UserRole.SCHOOL_ADMIN]

function isAdmin(role: string | undefined): boolean {
    return ADMIN_ROLES.includes(role as string)
}

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/classes/[id]/teachers
 * Get all teachers for a class
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        await connectDB()
        const { id: classId } = await params

        if (!isAdmin(session.user.role as string)) {
            const isTeacher = await ClassTeacherService.isTeacherInClass(classId, session.user.id)
            if (!isTeacher) {
                return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
            }
        }

        const teachers = await ClassTeacherService.getClassTeachers(classId)

        return NextResponse.json({
            success: true,
            data: teachers
        })

    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * POST /api/classes/[id]/teachers
 * Add a teacher to a class for a specific subject
 *
 * Body: { teacherId, subjectId, role?, permissions? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        await connectDB()
        const { id: classId } = await params
        const body = await request.json()
        const { teacherId, subjectId, role, permissions } = body

        if (!teacherId || !subjectId) {
            return NextResponse.json({
                error: 'teacherId et subjectId sont requis'
            }, { status: 400 })
        }

        // Admins bypass permission checks
        if (!isAdmin(session.user.role as string)) {
            const hasInvitePermission = await ClassTeacherService.hasPermission(
                classId, session.user.id, ClassTeacherPermission.INVITE_TEACHERS
            )
            const classDoc = await Class.findById(classId).lean()
            const isOwner = classDoc?.mainTeacher?.toString() === session.user.id

            if (!hasInvitePermission && !isOwner) {
                return NextResponse.json({
                    error: 'Vous n\'avez pas la permission d\'inviter des enseignants'
                }, { status: 403 })
            }
        }

        const result = await ClassTeacherService.addTeacher(
            classId, teacherId, subjectId,
            role || ClassTeacherRole.COLLABORATOR,
            permissions,
            session.user.id
        )

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 })
        }

        return NextResponse.json({
            success: true, message: result.message, data: result.data
        }, { status: 201 })

    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * PUT /api/classes/[id]/teachers
 * Update teacher permissions
 *
 * Body: { teacherId, subjectId, permissions, role? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        await connectDB()
        const { id: classId } = await params
        const body = await request.json()
        const { teacherId, subjectId, permissions, role } = body

        if (!teacherId || !subjectId || !permissions) {
            return NextResponse.json({
                error: 'teacherId, subjectId et permissions sont requis'
            }, { status: 400 })
        }

        if (!isAdmin(session.user.role as string)) {
            const classDoc = await Class.findById(classId).lean()
            const isOwner = classDoc?.mainTeacher?.toString() === session.user.id
            const hasPermission = await ClassTeacherService.hasPermission(
                classId, session.user.id, ClassTeacherPermission.INVITE_TEACHERS
            )
            if (!isOwner && !hasPermission) {
                return NextResponse.json({
                    error: 'Vous n\'avez pas la permission de modifier les droits'
                }, { status: 403 })
            }
        }

        const result = await ClassTeacherService.updateTeacherPermissions(
            classId, teacherId, subjectId, permissions, role
        )

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 })
        }

        return NextResponse.json({
            success: true, message: result.message, data: result.data
        })

    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * PATCH /api/classes/[id]/teachers
 * Toggle a teacher's active status (approve / deactivate).
 * Admin roles only.
 *
 * Body: { teacherId, subjectId, isActive: boolean }
 *
 * Bulk mode — pass an array:
 * Body: { bulk: [{ teacherId, subjectId, isActive }] }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        if (!isAdmin(session.user.role as string)) {
            return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
        }

        await connectDB()
        const { id: classId } = await params
        const body = await request.json()

        // Build list of updates (single or bulk)
        const updates: { teacherId: string; subjectId: string; isActive: boolean }[] = body.bulk
            ? body.bulk
            : [{ teacherId: body.teacherId, subjectId: body.subjectId, isActive: body.isActive }]

        if (updates.some(u => !u.teacherId || !u.subjectId || typeof u.isActive !== 'boolean')) {
            return NextResponse.json({ error: 'Champs teacherId, subjectId et isActive requis' }, { status: 400 })
        }

        const classDoc = await Class.findById(classId)
        if (!classDoc) {
            return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })
        }

        let changed = 0
        for (const { teacherId, subjectId, isActive: newActive } of updates) {
            const entry = (classDoc.teachers as any[]).find(
                (t: any) => t.teacher.toString() === teacherId && t.subject.toString() === subjectId
            )
            if (entry && entry.isActive !== newActive) {
                entry.isActive = newActive
                changed++
            }
        }

        if (changed > 0) {
            await classDoc.save()
        }

        return NextResponse.json({
            success: true,
            message: `${changed} enseignant(s) mis à jour`,
            changed,
        })

    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * DELETE /api/classes/[id]/teachers
 * Remove a teacher from a class
 *
 * Query: ?teacherId=xxx&subjectId=xxx
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        await connectDB()
        const { id: classId } = await params
        const searchParams = request.nextUrl.searchParams
        const teacherId = searchParams.get('teacherId')
        const subjectId = searchParams.get('subjectId')

        if (!teacherId || !subjectId) {
            return NextResponse.json({
                error: 'teacherId et subjectId sont requis'
            }, { status: 400 })
        }

        // Admins bypass ownership checks
        if (!isAdmin(session.user.role as string)) {
            const classDoc = await Class.findById(classId).lean()
            const isOwner = classDoc?.mainTeacher?.toString() === session.user.id
            const isSelf = teacherId === session.user.id
            if (!isOwner && !isSelf) {
                return NextResponse.json({
                    error: 'Vous n\'avez pas la permission de retirer des enseignants'
                }, { status: 403 })
            }
        }

        const result = await ClassTeacherService.removeTeacher(
            classId, teacherId, subjectId, session.user.id
        )

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: result.message })

    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
