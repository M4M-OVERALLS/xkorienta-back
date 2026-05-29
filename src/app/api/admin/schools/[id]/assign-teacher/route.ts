import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import mongoose from 'mongoose'
import School from '@/models/School'
import Class from '@/models/Class'
import Syllabus from '@/models/Syllabus'
import { ClassTeacherService } from '@/lib/services/ClassTeacherService'
import { ClassTeacherRole, UserRole } from '@/models/enums'

const PLATFORM_ADMIN_ROLES: string[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * POST /api/admin/schools/[id]/assign-teacher
 *
 * Assign a teacher as COLLABORATOR to one or more classes of the school.
 * The teacher is NOT set as mainTeacher — they join as a collaborator.
 *
 * Body: { teacherId: string, subjectId: string, classIds: string[] }
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !PLATFORM_ADMIN_ROLES.includes(session.user.role as string)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const { id: schoolId } = await params

    let body: { teacherId?: string; subjectId?: string; classIds?: string[] }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ success: false, message: 'Corps de requête invalide' }, { status: 400 })
    }

    const { teacherId, subjectId, classIds } = body

    if (!teacherId || !subjectId || !Array.isArray(classIds) || classIds.length === 0) {
        return NextResponse.json(
            { success: false, message: 'teacherId, subjectId et classIds[] sont requis' },
            { status: 400 }
        )
    }

    // Verify teacher belongs to this school
    const school = await School.findById(schoolId).select('teachers').lean()
    if (!school) {
        return NextResponse.json({ success: false, message: 'École introuvable' }, { status: 404 })
    }
    const schoolTeacherIds = (school.teachers ?? []).map((t: any) => t.toString())
    if (!schoolTeacherIds.includes(teacherId)) {
        return NextResponse.json(
            { success: false, message: "Ce professeur n'est pas affilié à cette école" },
            { status: 400 }
        )
    }

    // Verify all classes belong to this school
    const schoolClasses = await Class.find(
        { _id: { $in: classIds.map(id => new mongoose.Types.ObjectId(id)) }, school: schoolId },
        { _id: 1 }
    ).lean()
    const validClassIds = new Set(schoolClasses.map((c: any) => c._id.toString()))

    const results: { classId: string; success: boolean; message: string }[] = []

    for (const cid of classIds) {
        if (!validClassIds.has(cid)) {
            results.push({ classId: cid, success: false, message: "Classe non trouvée dans cette école" })
            continue
        }
        const res = await ClassTeacherService.addTeacher(
            cid, teacherId, subjectId,
            ClassTeacherRole.COLLABORATOR,
            undefined,
            session.user.id
        )
        results.push({ classId: cid, success: res.success, message: res.message || 'OK' })
    }

    // Link syllabuses (best-effort)
    const classOids = classIds
        .filter(cid => validClassIds.has(cid))
        .map(cid => new mongoose.Types.ObjectId(cid))
    if (classOids.length > 0) {
        await Syllabus.updateMany(
            { teacher: new mongoose.Types.ObjectId(teacherId) },
            { $addToSet: { classes: { $each: classOids } } }
        )
    }

    const assigned = results.filter(r => r.success).length
    return NextResponse.json({
        success: true,
        message: `${assigned}/${classIds.length} classe(s) affectée(s)`,
        data: results,
    })
}
