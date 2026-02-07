import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '@/models/User';
import Class from '@/models/Class';
import Subject from '@/models/Subject';
import Notification from '@/models/Notification';
import Invitation from '@/models/Invitation';
import { UserRole, ClassTeacherRole } from '@/models/enums';
import { ClassTeacherService } from './ClassTeacherService';
import {
    sendTeacherAddedEmail,
    sendTeacherActivationEmail
} from '@/lib/mail';

export interface InviteTeacherResult {
    success: boolean;
    status: 'ENROLLED' | 'INVITED' | 'ERROR';
    message: string;
    teacherId?: string;
    teacherName?: string;
    teacherEmail?: string;
}

export class TeacherInvitationService {

    /**
     * Invite a teacher to a class
     * - If teacher exists: add to class and send notification email
     * - If teacher doesn't exist: create account with temp password, create invitation, send activation email
     */
    static async inviteTeacher(
        classId: string,
        email: string,
        name: string,
        subjectIds: string[],
        role: ClassTeacherRole,
        permissions: string[],
        invitedByUserId: string
    ): Promise<InviteTeacherResult> {
        try {
            // Normalize email
            const normalizedEmail = email.toLowerCase().trim();

            // Get class info
            const classDoc = await Class.findById(classId)
                .populate('mainTeacher', 'name email')
                .populate('school', 'name');

            if (!classDoc) {
                return { success: false, status: 'ERROR', message: 'Classe non trouvée' };
            }

            // Get inviter info
            const inviter = await User.findById(invitedByUserId);
            if (!inviter) {
                return { success: false, status: 'ERROR', message: 'Invitant non trouvé' };
            }

            // Check if teacher already exists
            let existingUser = await User.findOne({ email: normalizedEmail });

            // Get subject names for emails
            const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('name');
            const subjectNames = subjects.map(s => s.name);

            const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

            if (existingUser) {
                // Teacher exists - add to class for each subject
                let addedCount = 0;
                let alreadyAssignedCount = 0;

                for (const subjectId of subjectIds) {
                    const result = await ClassTeacherService.addTeacher(
                        classId,
                        existingUser._id.toString(),
                        subjectId,
                        role,
                        permissions as any,
                        invitedByUserId
                    );

                    if (result.success) {
                        addedCount++;
                    } else if (result.message.includes('déjà assigné')) {
                        alreadyAssignedCount++;
                    }
                }

                if (addedCount === 0 && alreadyAssignedCount > 0) {
                    return {
                        success: false,
                        status: 'ERROR',
                        message: 'Cet enseignant est déjà assigné à ces matières',
                        teacherId: existingUser._id.toString(),
                        teacherName: existingUser.name,
                        teacherEmail: existingUser.email
                    };
                }

                // Send email to existing teacher
                try {
                    await sendTeacherAddedEmail(
                        normalizedEmail,
                        existingUser.name,
                        classDoc.name,
                        inviter.name,
                        subjectNames,
                        loginUrl
                    );
                } catch (err) {
                    console.error('[TeacherInvitation] Failed to send added email:', err);
                }

                // Create notification
                try {
                    await Notification.create({
                        userId: existingUser._id,
                        type: 'class',
                        title: 'Ajout à une classe',
                        message: `Vous avez été ajouté comme enseignant dans "${classDoc.name}" par ${inviter.name}`,
                        data: {
                            classId,
                            className: classDoc.name,
                            subjects: subjectNames,
                            addedBy: inviter.name
                        }
                    });
                } catch (err) {
                    console.error('[TeacherInvitation] Failed to create notification:', err);
                }

                return {
                    success: true,
                    status: 'ENROLLED',
                    message: `${existingUser.name} a été ajouté à la classe`,
                    teacherId: existingUser._id.toString(),
                    teacherName: existingUser.name,
                    teacherEmail: existingUser.email
                };
            }

            // Teacher doesn't exist - create new account
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            // Create user
            const newUser = await User.create({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                role: UserRole.TEACHER,
                isActive: false,
                emailVerified: false
            });

            // Create pedagogical profile
            try {
                const PedagogicalProfile = (await import('@/models/PedagogicalProfile')).default;
                await PedagogicalProfile.create({
                    user: newUser._id,
                    teachingSubjects: subjectIds
                });
            } catch (err) {
                console.error('[TeacherInvitation] Failed to create pedagogical profile:', err);
            }

            // Create invitation token
            const token = crypto.randomBytes(32).toString('hex');

            await Invitation.create({
                token,
                classId,
                email: normalizedEmail,
                type: 'INDIVIDUAL',
                status: 'PENDING',
                createdBy: invitedByUserId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                currentUses: 0,
                registeredStudents: []
            });

            const activationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${token}`;

            // Add teacher to class for each subject immediately
            // They will be able to access once they activate their account
            for (const subjectId of subjectIds) {
                try {
                    await ClassTeacherService.addTeacher(
                        classId,
                        newUser._id.toString(),
                        subjectId,
                        role,
                        permissions as any,
                        invitedByUserId
                    );
                } catch (err) {
                    console.error(`[TeacherInvitation] Failed to add teacher to class for subject ${subjectId}:`, err);
                }
            }

            // Send activation email
            try {
                await sendTeacherActivationEmail(
                    normalizedEmail,
                    name,
                    classDoc.name,
                    inviter.name,
                    subjectNames,
                    activationLink
                );
            } catch (err) {
                console.error('[TeacherInvitation] Failed to send activation email:', err);
            }

            return {
                success: true,
                status: 'INVITED',
                message: `Invitation envoyée à ${name}`,
                teacherId: newUser._id.toString(),
                teacherName: name,
                teacherEmail: normalizedEmail
            };

        } catch (error: any) {
            console.error('[TeacherInvitationService.inviteTeacher] Error:', error);
            return {
                success: false,
                status: 'ERROR',
                message: error.message || 'Erreur serveur'
            };
        }
    }

    /**
     * Process Excel import for teachers
     * Returns results for each teacher
     */
    static async importTeachersFromExcel(
        classId: string,
        teachers: { name: string; email: string }[],
        subjectIds: string[],
        role: ClassTeacherRole,
        permissions: string[],
        invitedByUserId: string
    ): Promise<InviteTeacherResult[]> {
        const results: InviteTeacherResult[] = [];

        for (const teacher of teachers) {
            const result = await this.inviteTeacher(
                classId,
                teacher.email,
                teacher.name,
                subjectIds,
                role,
                permissions,
                invitedByUserId
            );
            results.push(result);
        }

        return results;
    }
}
