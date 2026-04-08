import mongoose from 'mongoose'
import Class, { IClassTeacher } from '@/models/Class'
import User from '@/models/User'
import Subject from '@/models/Subject'
import {
    ClassTeacherRole,
    ClassTeacherPermission,
    ClassTeacherInvitationStatus
} from '@/models/enums'

/** Compare deux refs Mongoose (ObjectId, string, ou doc peuplé avec _id) */
function sameRefId(a: unknown, b: string): boolean {
    if (a == null || b == null || b === '') return false
    const rawA =
        typeof a === 'object' &&
        a !== null &&
        '_id' in a &&
        (a as { _id: unknown })._id != null
            ? (a as { _id: unknown })._id
            : a
    const sa = String(rawA)
    const sb = String(b).trim()
    try {
        if (!mongoose.Types.ObjectId.isValid(sa) || !mongoose.Types.ObjectId.isValid(sb)) {
            return sa === sb
        }
        return new mongoose.Types.ObjectId(sa).equals(new mongoose.Types.ObjectId(sb))
    } catch {
        return sa === sb
    }
}

/**
 * ClassTeacherService
 * 
 * Manages the multi-teacher collaboration system for classes.
 * Allows adding, removing, and managing teachers with specific subjects and permissions.
 * 
 * @example
 * // Add a teacher to a class for a specific subject
 * await ClassTeacherService.addTeacher(
 *   classId,
 *   teacherId,
 *   subjectId,
 *   ClassTeacherRole.COLLABORATOR,
 *   [ClassTeacherPermission.CREATE_EXAM, ClassTeacherPermission.GRADE_STUDENTS],
 *   addedByUserId
 * )
 */
export class ClassTeacherService {

    /**
     * Get default permissions based on role
     */
    static getDefaultPermissions(role: ClassTeacherRole): ClassTeacherPermission[] {
        switch (role) {
            case ClassTeacherRole.OWNER:
                // Owners have all permissions
                return Object.values(ClassTeacherPermission)

            case ClassTeacherRole.COLLABORATOR:
                // Collaborators have most permissions except inviting teachers
                return [
                    ClassTeacherPermission.CREATE_EXAM,
                    ClassTeacherPermission.EDIT_EXAM,
                    ClassTeacherPermission.DELETE_EXAM,
                    ClassTeacherPermission.PUBLISH_EXAM,
                    ClassTeacherPermission.GRADE_STUDENTS,
                    ClassTeacherPermission.VIEW_STUDENTS,
                    ClassTeacherPermission.CREATE_FORUM,
                    ClassTeacherPermission.SEND_MESSAGES,
                    ClassTeacherPermission.VIEW_ANALYTICS
                ]

            case ClassTeacherRole.ASSISTANT:
                // Assistants have limited permissions by default
                return [
                    ClassTeacherPermission.VIEW_STUDENTS,
                    ClassTeacherPermission.GRADE_STUDENTS,
                    ClassTeacherPermission.VIEW_ANALYTICS
                ]

            default:
                return []
        }
    }

    /**
     * Add a teacher to a class for a specific subject
     */
    static async addTeacher(
        classId: string,
        teacherId: string,
        subjectId: string,
        role: ClassTeacherRole = ClassTeacherRole.COLLABORATOR,
        permissions?: ClassTeacherPermission[],
        addedBy?: string
    ): Promise<{ success: boolean; message: string; data?: any; code?: string }> {
        try {
            // Validate class exists
            const classDoc = await Class.findById(classId)
            if (!classDoc) {
                return { success: false, message: 'Classe non trouvée' }
            }

            // Validate teacher exists
            const teacher = await User.findById(teacherId)
            if (!teacher) {
                return { success: false, message: 'Enseignant non trouvé' }
            }

            // Validate subject exists
            const subject = await Subject.findById(subjectId)
            if (!subject) {
                return { success: false, message: 'Matière non trouvée' }
            }

            // Doublon : même enseignant + même matière dans cette classe (liens ObjectId / peuplés)
            const existingTeacher = classDoc.teachers?.find(
                (t: any) =>
                    sameRefId(t.teacher, teacherId) &&
                    sameRefId(t.subject, subjectId) &&
                    t.isActive !== false
            )
            if (existingTeacher) {
                return {
                    success: false,
                    code: 'ALREADY_ASSIGNED',
                    message: 'Cet enseignant est déjà assigné à cette matière dans cette classe'
                }
            }

            // Determine permissions
            const finalPermissions = permissions || this.getDefaultPermissions(role)

            // Create the teacher entry
            const teacherEntry: Partial<IClassTeacher> = {
                teacher: new mongoose.Types.ObjectId(teacherId),
                subject: new mongoose.Types.ObjectId(subjectId),
                role,
                permissions: finalPermissions,
                addedBy: new mongoose.Types.ObjectId(addedBy || classDoc.mainTeacher.toString()),
                addedAt: new Date(),
                isActive: true
            }

            // Add to class
            if (!classDoc.teachers) {
                classDoc.teachers = []
            }
            classDoc.teachers.push(teacherEntry as IClassTeacher)
            await classDoc.save()

            // Return the added entry (without population to avoid StrictPopulateError)
            // The caller can fetch populated data separately if needed
            return {
                success: true,
                message: 'Enseignant ajouté avec succès',
                data: {
                    teacher: teacherId,
                    subject: subjectId,
                    role,
                    permissions: finalPermissions,
                    teacherName: teacher.name,
                    teacherEmail: teacher.email,
                    subjectName: subject.name
                }
            }

        } catch (error: any) {
            console.error('[ClassTeacherService.addTeacher] Error:', error)
            return { success: false, message: error.message || 'Erreur serveur' }
        }
    }

    /**
     * Remove a teacher from a class (for a specific subject)
     */
    static async removeTeacher(
        classId: string,
        teacherId: string,
        subjectId: string,
        removedBy: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            const classDoc = await Class.findById(classId)
            if (!classDoc) {
                return { success: false, message: 'Classe non trouvée' }
            }

            // Find and remove the teacher entry
            const teacherIndex = classDoc.teachers?.findIndex(
                (t: any) =>
                    sameRefId(t.teacher, teacherId) &&
                    sameRefId(t.subject, subjectId)
            )

            if (teacherIndex === undefined || teacherIndex === -1) {
                return { success: false, message: 'Enseignant non trouvé dans cette classe' }
            }

            // Cannot remove the owner if they're the main teacher
            const teacherEntry = classDoc.teachers[teacherIndex]
            if (
                teacherEntry.role === ClassTeacherRole.OWNER &&
                teacherEntry.teacher.toString() === classDoc.mainTeacher.toString()
            ) {
                return { success: false, message: 'Impossible de retirer le propriétaire principal de la classe' }
            }

            // Remove the teacher
            classDoc.teachers.splice(teacherIndex, 1)
            await classDoc.save()

            return { success: true, message: 'Enseignant retiré avec succès' }

        } catch (error: any) {
            console.error('[ClassTeacherService.removeTeacher] Error:', error)
            return { success: false, message: error.message || 'Erreur serveur' }
        }
    }

    /**
     * Update teacher permissions
     */
    static async updateTeacherPermissions(
        classId: string,
        teacherId: string,
        subjectId: string,
        newPermissions: ClassTeacherPermission[],
        newRole?: ClassTeacherRole
    ): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            const classDoc = await Class.findById(classId)
            if (!classDoc) {
                return { success: false, message: 'Classe non trouvée' }
            }

            const teacherEntry = classDoc.teachers?.find(
                (t: any) =>
                    sameRefId(t.teacher, teacherId) &&
                    sameRefId(t.subject, subjectId)
            )

            if (!teacherEntry) {
                return { success: false, message: 'Enseignant non trouvé dans cette classe' }
            }

            // Update permissions
            teacherEntry.permissions = newPermissions
            if (newRole) {
                teacherEntry.role = newRole
            }

            await classDoc.save()

            return {
                success: true,
                message: 'Permissions mises à jour',
                data: teacherEntry
            }

        } catch (error: any) {
            console.error('[ClassTeacherService.updateTeacherPermissions] Error:', error)
            return { success: false, message: error.message || 'Erreur serveur' }
        }
    }

    /**
     * Get all teachers for a class
     */
    static async getClassTeachers(classId: string): Promise<any[]> {
        try {
            const classDoc = await Class.findById(classId).lean()

            if (!classDoc || !classDoc.teachers) {
                return []
            }

            // Manually populate the references in subdocuments
            const User = mongoose.model('User')
            const Subject = mongoose.model('Subject')

            const populatedTeachers = await Promise.all(
                classDoc.teachers.map(async (teacherEntry: any) => {
                    const [teacher, subject, addedBy] = await Promise.all([
                        User.findById(teacherEntry.teacher).select('name email image role').lean(),
                        Subject.findById(teacherEntry.subject).select('name code metadata').lean(),
                        User.findById(teacherEntry.addedBy).select('name').lean()
                    ])

                    return {
                        ...teacherEntry,
                        teacher,
                        subject,
                        addedBy
                    }
                })
            )

            return populatedTeachers

        } catch (error) {
            console.error('[ClassTeacherService.getClassTeachers] Error:', error)
            return []
        }
    }

    /**
     * Check if a user has a specific permission in a class
     */
    static async hasPermission(
        classId: string,
        userId: string,
        permission: ClassTeacherPermission,
        subjectId?: string
    ): Promise<boolean> {
        try {
            const classDoc = await Class.findById(classId).lean()
            if (!classDoc) {
                return false
            }

            // Main teacher (owner) has all permissions
            if (classDoc.mainTeacher.toString() === userId) {
                return true
            }

            // Check in teachers array
            const teacherEntries = (classDoc.teachers || []).filter((t: any) =>
                t.teacher.toString() === userId &&
                t.isActive &&
                (!subjectId || t.subject.toString() === subjectId)
            )

            // Check if any entry has the required permission
            return teacherEntries.some((entry: any) =>
                entry.permissions.includes(permission)
            )

        } catch (error) {
            console.error('[ClassTeacherService.hasPermission] Error:', error)
            return false
        }
    }

    /**
     * Check if a user is a teacher in a class (any subject)
     */
    static async isTeacherInClass(classId: string, userId: string): Promise<boolean> {
        try {
            const classDoc = await Class.findById(classId).lean()
            if (!classDoc) {
                return false
            }

            if (sameRefId(classDoc.mainTeacher, userId)) {
                return true
            }

            return (classDoc.teachers || []).some(
                (t: any) => sameRefId(t.teacher, userId) && t.isActive !== false
            )

        } catch (error) {
            console.error('[ClassTeacherService.isTeacherInClass] Error:', error)
            return false
        }
    }

    /**
     * Get all classes where a user is a teacher (main or collaborator)
     */
    static async getTeacherClasses(userId: string): Promise<any[]> {
        try {
            let oid: mongoose.Types.ObjectId
            try {
                oid = new mongoose.Types.ObjectId(userId)
            } catch {
                return []
            }
            const classes = await Class.find({
                $or: [
                    { mainTeacher: oid },
                    {
                        teachers: {
                            $elemMatch: { teacher: oid, isActive: true }
                        }
                    }
                ],
                isActive: true
            })
                .populate('school', 'name')
                .populate('level', 'name')
                .lean()

            // Manually populate teachers.subject for each class
            const Subject = mongoose.model('Subject')

            const classesWithPopulatedSubjects = await Promise.all(
                classes.map(async (classDoc: any) => {
                    if (classDoc.teachers && classDoc.teachers.length > 0) {
                        const populatedTeachers = await Promise.all(
                            classDoc.teachers.map(async (t: any) => {
                                const subject = await Subject.findById(t.subject).select('name code').lean()
                                return { ...t, subject }
                            })
                        )
                        return { ...classDoc, teachers: populatedTeachers }
                    }
                    return classDoc
                })
            )

            return classesWithPopulatedSubjects

        } catch (error) {
            console.error('[ClassTeacherService.getTeacherClasses] Error:', error)
            return []
        }
    }

    /**
     * Get the subjects a teacher can manage in a specific class
     */
    static async getTeacherSubjectsInClass(classId: string, teacherId: string): Promise<any[]> {
        try {
            const classDoc = await Class.findById(classId).lean()

            if (!classDoc) {
                return []
            }

            // Get subject IDs first
            let subjectIds: any[] = []

            // If main teacher, they can access all subjects assigned to collaborators
            if (classDoc.mainTeacher.toString() === teacherId) {
                subjectIds = (classDoc.teachers || [])
                    .filter((t: any) => t.isActive)
                    .map((t: any) => t.subject)
            } else {
                // Otherwise, return only their assigned subjects
                subjectIds = (classDoc.teachers || [])
                    .filter((t: any) => t.teacher.toString() === teacherId && t.isActive)
                    .map((t: any) => t.subject)
            }

            // Manually populate subjects
            if (subjectIds.length > 0) {
                const Subject = mongoose.model('Subject')
                const subjects = await Subject.find({ _id: { $in: subjectIds } })
                    .select('name code metadata')
                    .lean()
                return subjects
            }

            return []

        } catch (error) {
            console.error('[ClassTeacherService.getTeacherSubjectsInClass] Error:', error)
            return []
        }
    }
}
