import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { TeacherInvitationService } from '@/lib/services/TeacherInvitationService';
import { ClassTeacherService } from '@/lib/services/ClassTeacherService';
import { ClassTeacherPermission } from '@/models/enums';
import Class from '@/models/Class';

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/classes/[id]/teachers/invite
 * Invite a teacher to a class (create account if doesn't exist)
 * 
 * Request body:
 * {
 *   email: string,
 *   name: string,
 *   subjectIds: string[],
 *   role?: string,
 *   permissions?: string[]
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const { id: classId } = await params;
        const body = await request.json();
        const { email, name, subjectIds, role, permissions } = body;

        // Validation
        if (!email || !name) {
            return NextResponse.json(
                { error: 'Email et nom sont requis' },
                { status: 400 }
            );
        }

        if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
            return NextResponse.json(
                { error: 'Au moins une matière est requise' },
                { status: 400 }
            );
        }

        // Check permissions
        const hasInvitePermission = await ClassTeacherService.hasPermission(
            classId,
            session.user.id,
            ClassTeacherPermission.INVITE_TEACHERS
        );

        const classDoc = await Class.findById(classId).lean();
        const isOwner = classDoc?.mainTeacher?.toString() === session.user.id;

        if (!hasInvitePermission && !isOwner) {
            return NextResponse.json(
                { error: 'Vous n\'avez pas la permission d\'inviter des enseignants' },
                { status: 403 }
            );
        }

        // Invite teacher
        const result = await TeacherInvitationService.inviteTeacher(
            classId,
            email,
            name,
            subjectIds,
            role || 'COLLABORATOR',
            permissions,
            session.user.id
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            status: result.status,
            message: result.message,
            data: {
                teacherId: result.teacherId,
                teacherName: result.teacherName,
                teacherEmail: result.teacherEmail
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Teacher Invite POST] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/classes/[id]/teachers/invite/bulk
 * Import multiple teachers from Excel
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const { id: classId } = await params;
        const body = await request.json();
        const { teachers, subjectIds, role, permissions } = body;

        if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
            return NextResponse.json(
                { error: 'Liste d\'enseignants requise' },
                { status: 400 }
            );
        }

        // Check permissions
        const hasInvitePermission = await ClassTeacherService.hasPermission(
            classId,
            session.user.id,
            ClassTeacherPermission.INVITE_TEACHERS
        );

        const classDoc = await Class.findById(classId).lean();
        const isOwner = classDoc?.mainTeacher?.toString() === session.user.id;

        if (!hasInvitePermission && !isOwner) {
            return NextResponse.json(
                { error: 'Permission refusée' },
                { status: 403 }
            );
        }

        // Process bulk import
        const results = await TeacherInvitationService.importTeachersFromExcel(
            classId,
            teachers,
            subjectIds,
            role || 'COLLABORATOR',
            permissions,
            session.user.id
        );

        const successCount = results.filter(r => r.success).length;
        const enrolledCount = results.filter(r => r.status === 'ENROLLED').length;
        const invitedCount = results.filter(r => r.status === 'INVITED').length;
        const errorCount = results.filter(r => r.status === 'ERROR').length;

        return NextResponse.json({
            success: true,
            message: `${successCount}/${results.length} enseignants traités`,
            data: {
                total: results.length,
                enrolled: enrolledCount,
                invited: invitedCount,
                errors: errorCount,
                results
            }
        });

    } catch (error: any) {
        console.error('[Teacher Bulk Invite PUT] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
