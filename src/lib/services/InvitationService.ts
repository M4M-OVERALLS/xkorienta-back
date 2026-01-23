import Invitation from "@/models/Invitation";
import User, { IUser } from "@/models/User";
import Class from "@/models/Class";
import School from "@/models/School";
import ImportLog from "@/models/ImportLog";
import crypto from "crypto";
import { sendInvitationEmail, sendAccountActivationEmail, sendWelcomeEmail, sendTeacherNotification, sendImportReportEmail } from "@/lib/mail";
import { ClassService } from "./ClassService";
import { SchoolService } from "./SchoolService";
import bcrypt from "bcryptjs";
import { UserRole } from "@/models/enums";
import { InvitationRepository } from "@/lib/repositories/InvitationRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";

export interface CreateLinkOptions {
    expiresIn?: '24h' | '7d' | '30d' | 'never'
    maxUses?: number
    description?: string
}

export class InvitationService {

    /**
     * Generate or retrieve an active invitation link for a CLASS
     */
    static async getOrCreateLink(classId: string, teacherId: string, options?: CreateLinkOptions) {
        if (!options) {
            const existing = await Invitation.findOne({
                classId,
                type: 'LINK',
                status: 'PENDING',
                $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
            });

            if (existing) {
                return existing;
            }
        }

        let expiresAt: Date | undefined;
        if (options?.expiresIn && options.expiresIn !== 'never') {
            const now = Date.now();
            switch (options.expiresIn) {
                case '24h': expiresAt = new Date(now + 24 * 60 * 60 * 1000); break;
                case '7d': expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000); break;
                case '30d': expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000); break;
            }
        } else if (!options?.expiresIn) {
            expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        const token = crypto.randomBytes(32).toString('hex');
        const invitation = await Invitation.create({
            token,
            classId,
            type: 'LINK',
            status: 'PENDING',
            createdBy: teacherId,
            expiresAt,
            maxUses: options?.maxUses,
            currentUses: 0,
            registeredStudents: [],
            description: options?.description
        });

        return invitation;
    }

    /**
     * Get invitation by token with validation
     */
    static async getInvitationByToken(token: string) {
        const invitation = await Invitation.findOne({ token })
            .populate({
                path: 'classId',
                select: 'name academicYear',
                populate: [
                    { path: 'school', select: 'name' },
                    { path: 'mainTeacher', select: 'name email' }
                ]
            });

        if (!invitation) return null;

        if (invitation.expiresAt && invitation.expiresAt < new Date()) {
            invitation.status = 'EXPIRED';
            await invitation.save();
            return null;
        }

        if (invitation.status === 'REVOKED') {
            return null;
        }

        if (invitation.maxUses && invitation.currentUses >= invitation.maxUses) {
            return null;
        }

        return invitation;
    }

    /**
     * Revoke an invitation link
     */
    static async revokeInvitation(invitationId: string, userId: string) {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new Error("Invitation not found");
        if (invitation.createdBy.toString() !== userId) {
            throw new Error("Not authorized to revoke this invitation");
        }

        invitation.status = 'REVOKED';
        await invitation.save();
        return invitation;
    }

    /**
     * Get all invitations for a class
     */
    static async getClassInvitations(classId: string) {
        return await Invitation.find({ classId })
            .populate('registeredStudents', 'name email')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
    }

    /**
     * Get invitation stats for a class
     */
    static async getClassInvitationStats(classId: string) {
        const invitations = await Invitation.find({ classId, type: 'LINK' });

        return {
            totalLinks: invitations.length,
            activeLinks: invitations.filter(i => i.status === 'PENDING').length,
            totalRegistrations: invitations.reduce((sum, i) => sum + i.currentUses, 0),
            recentRegistrations: invitations
                .flatMap(i => i.registeredStudents)
                .slice(-5)
        };
    }

    /**
     * Generate or retrieve an active invitation link for a SCHOOL
     */
    static async getOrCreateSchoolLink(schoolId: string, teacherId: string, role: string = 'TEACHER') {
        const existing = await Invitation.findOne({
            schoolId,
            type: 'LINK',
            status: 'PENDING',
            role,
            $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
        });

        if (existing) return existing;

        const token = crypto.randomBytes(32).toString('hex');
        return await Invitation.create({
            token,
            schoolId,
            type: 'LINK',
            status: 'PENDING',
            role,
            createdBy: teacherId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            currentUses: 0,
            registeredStudents: []
        });
    }

    /**
     * Invite a single student manually
     */
    static async inviteStudent(classId: string, email: string, name: string, teacherId: string) {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            await ClassService.enrollStudent(classId, existingUser._id.toString());
            return { status: 'ENROLLED', user: existingUser };
        }

        // Create user with random password that they will reset upon activation
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: UserRole.STUDENT,
            isActive: false, // Account is inactive until they claim it via link
            emailVerified: false,
        });

        const token = crypto.randomBytes(32).toString('hex');

        await Invitation.create({
            token,
            classId,
            email,
            type: 'INDIVIDUAL',
            status: 'PENDING',
            createdBy: teacherId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            currentUses: 0,
            registeredStudents: []
        });

        const classData = await Class.findById(classId);
        const joinLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${token}`;

        // Send activation email WITHOUT temp password
        await sendAccountActivationEmail(email, joinLink, classData?.name || 'la classe');

        return { status: 'INVITED', user: newUser };
    }

    /**
     * Invite a Teacher manually to a School
     */
    static async inviteTeacher(schoolId: string, email: string, name: string, inviterId: string, role: string = 'TEACHER') {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            await SchoolService.addTeacherToSchool(schoolId, existingUser._id.toString());
            return { status: 'ENROLLED', user: existingUser };
        }

        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role as UserRole,
            isActive: false,
            emailVerified: false,
        });

        const token = crypto.randomBytes(32).toString('hex');

        await Invitation.create({
            token,
            schoolId,
            email,
            role,
            type: 'INDIVIDUAL',
            status: 'PENDING',
            createdBy: inviterId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            currentUses: 0,
            registeredStudents: []
        });

        const schoolData = await School.findById(schoolId);
        const joinLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${token}`;

        await sendAccountActivationEmail(email, joinLink, schoolData?.name || "l'école", tempPassword);

        return { status: 'INVITED', user: newUser };
    }

    /**
     * Accept an invitation (Link or Individual) - Enhanced with notifications
     */
    static async acceptInvitation(token: string, userId: string) {
        const invitationRepo = new InvitationRepository();
        const userRepo = new UserRepository();

        const invitation = await invitationRepo.findByToken(token);

        if (!invitation) throw new Error("Invitation invalide ou expirée");
        if (invitation.expiresAt && invitation.expiresAt < new Date()) {
            invitation.status = 'EXPIRED';
            await invitationRepo.save(invitation);
            throw new Error("Invitation expirée");
        }

        if (invitation.type === 'LINK' && invitation.maxUses && invitation.currentUses >= invitation.maxUses) {
            throw new Error("Cette invitation a atteint son nombre maximum d'utilisations");
        }

        let resourceId = null;

        if (invitation.classId) {
            const classIdStr = (invitation.classId as any)._id
                ? (invitation.classId as any)._id.toString()
                : invitation.classId.toString();

            await ClassService.enrollStudent(classIdStr, userId);
            resourceId = classIdStr;
        } else if (invitation.schoolId) {
            await SchoolService.addTeacherToSchool(invitation.schoolId.toString(), userId);
            resourceId = invitation.schoolId;
        }

        if (invitation.type === 'LINK') {
            invitation.currentUses += 1;
            invitation.registeredStudents.push(userId as any);
            await invitationRepo.save(invitation);
        }

        if (invitation.type === 'INDIVIDUAL') {
            invitation.status = 'ACCEPTED';
            await invitationRepo.save(invitation);

            const user = await userRepo.findById(userId);
            if (user && !user.isActive) {
                user.isActive = true;
                user.emailVerified = true;
                await userRepo.save(user);
            }
        }

        return { success: true, classId: invitation.classId, schoolId: invitation.schoolId };
    }

    /**
     * Register a new user via invitation link - Enhanced with welcome email and teacher notification
     */
    static async registerViaInvitation(token: string, userData: { name: string; email: string; password: string }) {
        const invitation = await this.getInvitationByToken(token);
        if (!invitation) {
            throw new Error("Lien d'invitation invalide ou expiré");
        }

        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            throw new Error("Un compte existe déjà avec cet email");
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const newUser = await User.create({
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: UserRole.STUDENT,
            isActive: true,
            emailVerified: true,
        });

        await this.acceptInvitation(token, newUser._id.toString());

        // Get class info for emails
        const classInfo = invitation.classId as any;
        const className = classInfo?.name || 'la classe';
        const teacher = classInfo?.mainTeacher;

        // Send welcome email to student
        try {
            await sendWelcomeEmail(userData.email, userData.name, className);
        } catch (err) {
            console.error("Failed to send welcome email:", err);
        }

        // Notify teacher
        if (teacher?.email) {
            try {
                await sendTeacherNotification(
                    teacher.email,
                    teacher.name,
                    userData.name,
                    userData.email,
                    className
                );
            } catch (err) {
                console.error("Failed to notify teacher:", err);
            }
        }

        return { success: true, user: newUser };
    }

    /**
     * Process Batch Import for Students with logging
     */
    static async processBatch(
        classId: string,
        students: { name: string; email: string }[],
        teacherId: string,
        fileInfo?: { fileName: string; fileType: 'CSV' | 'XLSX'; fileSize: number }
    ) {
        // Create import log
        let importLog;
        if (fileInfo) {
            importLog = await ImportLog.create({
                classId,
                importedBy: teacherId,
                fileName: fileInfo.fileName,
                fileType: fileInfo.fileType,
                fileSize: fileInfo.fileSize,
                totalRows: students.length,
                status: 'PROCESSING',
                startedAt: new Date()
            });
        }

        const results = {
            enrolled: 0,
            invited: 0,
            errors: 0,
            details: [] as { email: string; name: string; status: 'enrolled' | 'invited' | 'error'; error?: string }[]
        };

        for (const student of students) {
            try {
                if (!student.email || !student.name) {
                    results.errors++;
                    results.details.push({
                        email: student.email || 'N/A',
                        name: student.name || 'N/A',
                        status: 'error' as const,
                        error: 'Données manquantes'
                    });
                    continue;
                }

                const result = await this.inviteStudent(classId, student.email, student.name, teacherId);
                if (result.status === 'ENROLLED') {
                    results.enrolled++;
                    results.details.push({ email: student.email, name: student.name, status: 'enrolled' as const });
                } else if (result.status === 'INVITED') {
                    results.invited++;
                    results.details.push({ email: student.email, name: student.name, status: 'invited' as const });
                }
            } catch (err: any) {
                console.error(`Error processing student ${student.email}:`, err);
                results.errors++;
                results.details.push({
                    email: student.email,
                    name: student.name,
                    status: 'error' as const,
                    error: err.message
                });
            }
        }

        // Update import log
        if (importLog) {
            importLog.status = 'COMPLETED';
            importLog.successCount = results.enrolled + results.invited;
            importLog.errorCount = results.errors;
            importLog.enrolledCount = results.enrolled;
            importLog.invitedCount = results.invited;
            importLog.details = results.details;
            importLog.errorDetails = results.details
                .filter(d => d.status === 'error')
                .map((d, i) => ({ row: i + 1, email: d.email, message: d.error || 'Unknown error' })) as any;
            importLog.completedAt = new Date();
            await importLog.save();
        }

        // Send report to teacher
        try {
            const teacher = await User.findById(teacherId);
            const classData = await Class.findById(classId);
            if (teacher?.email && classData) {
                await sendImportReportEmail(
                    teacher.email,
                    teacher.name,
                    classData.name,
                    {
                        total: students.length,
                        enrolled: results.enrolled,
                        invited: results.invited,
                        errors: results.errors
                    },
                    results.details
                        .filter(d => d.status === 'error')
                        .map(d => ({ email: d.email, message: d.error || 'Unknown' }))
                );
            }
        } catch (err) {
            console.error("Failed to send import report:", err);
        }

        return results;
    }

    /**
     * Process Batch Import for Teachers
     */
    static async processTeacherBatch(schoolId: string, teachers: { name: string; email: string }[], inviterId: string) {
        const results = {
            enrolled: 0,
            invited: 0,
            errors: 0
        };

        for (const teacher of teachers) {
            try {
                if (!teacher.email || !teacher.name) continue;

                const result = await this.inviteTeacher(schoolId, teacher.email, teacher.name, inviterId);
                if (result.status === 'ENROLLED') results.enrolled++;
                else if (result.status === 'INVITED') results.invited++;
            } catch (err) {
                console.error(`Error processing teacher ${teacher.email}:`, err);
                results.errors++;
            }
        }
        return results;
    }

    /**
     * Get import history for a class
     */
    static async getImportHistory(classId: string, limit: number = 10) {
        return await ImportLog.find({ classId })
            .populate('importedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(limit);
    }
}
