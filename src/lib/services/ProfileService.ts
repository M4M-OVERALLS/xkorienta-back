import LearnerProfile, { ILearnerProfile } from "@/models/LearnerProfile"
import PedagogicalProfile, { IPedagogicalProfile } from "@/models/PedagogicalProfile"
import User from "@/models/User"
import { UserRole } from "@/models/enums"
import mongoose from "mongoose"
// Import models to register their schemas for populate()
import "@/models/Subject"
import "@/models/EducationLevel"
import "@/models/Field"
import { LearnerProfileRepository } from "@/lib/repositories/LearnerProfileRepository"
import { PedagogicalProfileRepository } from "@/lib/repositories/PedagogicalProfileRepository"
import { ExamRepository } from "@/lib/repositories/ExamRepository"
import { ClassRepository } from "@/lib/repositories/ClassRepository"
import { AttemptRepository } from "@/lib/repositories/AttemptRepository"

export class ProfileService {
    /**
     * Retrieves the learner profile for a given user ID.
     * Populates relevant references.
     */
    static async getLearnerProfile(userId: string): Promise<ILearnerProfile | null> {
        const repo = new LearnerProfileRepository();
        return await repo.findByUserId(userId);
    }

    /**
     * Retrieves the pedagogical profile for a given user ID.
     * Populates relevant references.
     */
    static async getPedagogicalProfile(userId: string): Promise<IPedagogicalProfile | null> {
        const repo = new PedagogicalProfileRepository();
        return await repo.findByUserId(userId);
    }

    /**
     * Updates a learner profile.
     */
    static async updateLearnerProfile(userId: string, data: Partial<ILearnerProfile>): Promise<ILearnerProfile | null> {
        const repo = new LearnerProfileRepository();
        return await repo.update(userId, data);
    }

    /**
     * Updates a pedagogical profile.
     */
    static async updatePedagogicalProfile(userId: string, data: Partial<IPedagogicalProfile>): Promise<IPedagogicalProfile | null> {
        const repo = new PedagogicalProfileRepository();
        return await repo.update(userId, data);
    }

    /**
     * Gets the appropriate profile based on the user's role.
     */
    static async getUserProfile(userId: string): Promise<{ user: any, profile: any }> {
        const user = await User.findById(userId).select('-password').lean()
        if (!user) throw new Error("User not found")

        let profile = null
        if (user.role === UserRole.STUDENT) {
            profile = await this.getLearnerProfile(userId)
        } else {
            profile = await this.getPedagogicalProfile(userId)
        }

        return { user, profile }
    }

    /**
     * Gets aggregated statistics for a learner profile
     */
    static async getLearnerStats(userId: string): Promise<any> {
        const repo = new LearnerProfileRepository();
        const profile = await repo.findByUserIdWithStats(userId);

        if (!profile) return null

        // Récupérer des stats supplémentaires depuis Attempt/Response si nécessaire
        // TODO: Ajouter agrégations MongoDB pour stats avancées

        return {
            basic: {
                totalExamsTaken: profile.stats.totalExamsTaken,
                averageScore: profile.stats.averageScore,
                totalStudyTime: profile.stats.totalStudyTime,
                lastActivityDate: profile.stats.lastActivityDate
            },
            subjects: {
                strong: profile.stats.strongSubjects,
                weak: profile.stats.weakSubjects
            },
            gamification: {
                level: profile.gamification.level,
                xp: profile.gamification.xp,
                badges: profile.gamification.badges,
                streak: profile.gamification.streak
            },
            subscription: {
                status: profile.subscriptionStatus,
                expiry: profile.subscriptionExpiry
            }
        }
    }

    /**
     * Gets aggregated statistics for a pedagogical profile
     */
    static async getPedagogicalStats(userId: string): Promise<any> {
        const profile = await PedagogicalProfile.findOne({ user: userId })
            .populate('teachingSubjects', 'name code')
            .populate('interventionLevels', 'name code')
            .populate('interventionFields', 'name code')
            .lean()

        if (!profile) return null

        return {
            basic: {
                totalExamsCreated: profile.stats.totalExamsCreated,
                totalExamsValidated: profile.stats.totalExamsValidated,
                totalStudentsSupervised: profile.stats.totalStudentsSupervised,
                averageStudentScore: profile.stats.averageStudentScore,
                lastActivityDate: profile.stats.lastActivityDate
            },
            teaching: {
                subjects: profile.teachingSubjects,
                levels: profile.interventionLevels,
                fields: profile.interventionFields
            },
            access: {
                scope: profile.accessScope,
                reportingAccess: profile.reportingAccess,
                contributionTypes: profile.contributionTypes
            },
            qualifications: profile.qualifications
        }
    }

    /**
     * Retrieves recent activities for a user (teacher/admin)
     */
    static async getRecentActivities(userId: string, limit: number = 5): Promise<any[]> {
        const examRepo = new ExamRepository();

        // 1. Fetch recent exams created
        const recentExams = await examRepo.findRecentExamsByUser(userId, limit);

        // Transform to activity format
        const activities = recentExams.map((exam: any) => ({
            id: exam._id.toString(),
            type: 'EXAM_CREATED',
            title: 'Nouvel examen créé',
            description: `${exam.subject?.name || 'Matière inconnue'} - ${exam.targetLevels?.map((l: any) => l.name).join(', ') || 'Niveaux inconnus'}`,
            timestamp: exam.createdAt,
            user: { name: 'Moi' }, // Since it's the current user's activity
            metadata: {
                examId: exam._id.toString(),
                status: exam.status
            }
        }));

        // TODO: Add other types of activities (validations, publications, etc.)
        // For now, we just return exam creations

        return activities;
    }
    /**
     * Calculates real-time statistics for a teacher by querying related collections directly.
     * This ensures the dashboard shows up-to-date information without relying on cached profile stats.
     */
    static async getRealTimeTeacherStats(userId: string): Promise<any> {
        const examRepo = new ExamRepository();
        const classRepo = new ClassRepository();
        const attemptRepo = new AttemptRepository();

        // 1. Total Exams Created (all exams, including drafts)
        const totalExamsCreated = await examRepo.countExamsByTeacher(userId);

        // 2. Total Published Exams (all exams with status PUBLISHED or isPublished: true)
        const publishedExams = await examRepo.countPublishedExamsByTeacher(userId);

        // 3. Active Exams (Published and currently ongoing - between startTime and endTime)
        const activeExams = await examRepo.countActiveExamsByTeacher(userId);

        // 4. Total Students Reached (Unique students in teacher's classes)
        const classesWithStudents = await classRepo.findByTeacherWithStudents(userId);
        const studentIds = new Set<string>();
        classesWithStudents.forEach((c: any) => {
            if (c.students && Array.isArray(c.students)) {
                c.students.forEach((s: any) => studentIds.add(s.toString()));
            }
        });
        const totalStudentsReached = studentIds.size;

        // 5. Average Class Score (across all attempts for teacher's exams)
        const teacherExamIds = await examRepo.findExamIdsByTeacher(userId);
        const averageClassScore = await attemptRepo.getAverageScoreForExams(teacherExamIds);

        // 6. Calculate Gamification Level (Mock logic based on activity)
        // 1 Published Exam = 100 XP, 1 Draft Exam = 50 XP, 1 Student = 10 XP, 1% Avg Score = 5 XP
        const xp = (publishedExams * 100) + ((totalExamsCreated - publishedExams) * 50) + (totalStudentsReached * 10) + (averageClassScore * 5);
        const level = Math.floor(xp / 500) + 1;
        const nextLevelXp = level * 500;

        return {
            basic: {
                totalExamsCreated,
                totalStudentsReached,
                averageStudentScore: averageClassScore,
                activeExams: publishedExams  // Show published exams as "active" on dashboard
            },
            details: {
                publishedExams,
                ongoingExams: activeExams,
                draftExams: totalExamsCreated - publishedExams
            },
            gamification: {
                xp,
                level,
                nextLevelXp,
                title: level > 10 ? "Maître Pédagogue" : level > 5 ? "Professeur Expert" : "Enseignant Certifié"
            }
        }
    }
}

