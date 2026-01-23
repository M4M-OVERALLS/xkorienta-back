import { StudentRepository } from "@/lib/repositories/StudentRepository";
import { ClassRepository } from "@/lib/repositories/ClassRepository";
import { LearnerProfileRepository } from "@/lib/repositories/LearnerProfileRepository";
import { SchoolRepository } from "@/lib/repositories/SchoolRepository";
import { ChallengeRepository } from "@/lib/repositories/ChallengeRepository";
import { AttemptRepository } from "@/lib/repositories/AttemptRepository";
import { ExamRepository } from "@/lib/repositories/ExamRepository";
import { LeaderboardService, LeaderboardType, LeaderboardMetric } from "@/lib/services/LeaderboardService";
import { GamificationService } from "@/lib/services/GamificationService";
import { ClassService } from "@/lib/services/ClassService";
import { PredictionEngine } from "@/lib/services/PredictionEngine";
import { AnalyticsEngine } from "@/lib/services/AnalyticsEngine";
import { ChallengeStatus } from "@/models/Challenge";
import { MASTERY_LEVEL_PERCENTAGES, MasteryLevel } from "@/lib/patterns/EvaluationStrategy";
import { ILearnerProfile } from "@/models/LearnerProfile";
import { ORIENTATION_SCHOOLS_MOCK } from "@/lib/mocks/orientationSchools";
import { addMinutes, isAfter, isPast } from "date-fns";
import mongoose from "mongoose";

export interface StudentClassWithRank {
    id: string;
    name: string;
    schoolName: string;
    schoolLogo?: string;
    level: string;
    field?: string;
    mainTeacher: {
        name: string;
    };
    studentCount: number;
    academicYear: string;
    myRank?: number;
    myAverage?: number;
}

export interface StudentSubject {
    id: string;
    name: string;
    description?: string;
    averageScore: number;
    conceptsCount: number;
    conceptsMastered: number;
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    concepts: Array<{
        id: string;
        title: string;
        description?: string;
        currentLevel?: string;
        lastEvaluated?: string;
    }>;
}

export class StudentService {
    /**
     * Get all subjects for a student with their progress
     */
    static async getStudentSubjects(studentId: string): Promise<StudentSubject[]> {
        const repo = new StudentRepository();

        // 1. Find all classes the student is enrolled in
        const classes = await repo.findStudentClasses(studentId);

        if (classes.length === 0) {
            return [];
        }

        // 2. Get all syllabi for these classes
        const classIds = classes.map(c => c._id);
        const syllabi = await repo.findSyllabiByClasses(classIds);

        // 3. Get unique subjects
        const subjectMap = new Map<string, {
            id: string;
            name: string;
            description?: string;
            syllabi: mongoose.Types.ObjectId[];
        }>();

        for (const syllabus of syllabi) {
            const subject = syllabus.subject as unknown as Record<string, unknown> | null;
            if (!subject) continue;

            const subjectId = (subject._id as { toString: () => string }).toString();

            if (!subjectMap.has(subjectId)) {
                subjectMap.set(subjectId, {
                    id: subjectId,
                    name: subject.name as string,
                    description: subject.description as string | undefined,
                    syllabi: []
                });
            }

            subjectMap.get(subjectId)!.syllabi.push(syllabus._id);
        }

        // 4. For each subject, calculate progress
        const subjects: StudentSubject[] = [];

        for (const [subjectId, subjectData] of subjectMap) {
            // Get exams for this subject
            const exams = await repo.findPublishedExamsBySubject(subjectId);
            const examIds = exams.map(e => e._id);

            // Get student's attempts
            const attempts = await repo.findCompletedAttempts(studentId, examIds);

            // Calculate average score
            let averageScore = 0;
            if (attempts.length > 0) {
                averageScore = attempts.reduce((sum, a) =>
                    sum + ((a.score || 0) / (a.maxScore || 100)) * 100, 0
                ) / attempts.length;
            }

            // Calculate trend (compare recent to older)
            let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
            if (attempts.length >= 4) {
                const sorted = [...attempts].sort((a, b) =>
                    new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
                );
                const recent = sorted.slice(0, Math.floor(sorted.length / 2));
                const older = sorted.slice(Math.floor(sorted.length / 2));

                const recentAvg = recent.reduce((sum, a) =>
                    sum + ((a.score || 0) / (a.maxScore || 100)) * 100, 0
                ) / recent.length;
                const olderAvg = older.reduce((sum, a) =>
                    sum + ((a.score || 0) / (a.maxScore || 100)) * 100, 0
                ) / older.length;

                if (recentAvg > olderAvg + 5) trend = 'IMPROVING';
                else if (recentAvg < olderAvg - 5) trend = 'DECLINING';
            }

            // Get concepts from syllabi
            const concepts = await repo.findConceptsBySyllabi(subjectData.syllabi);

            // Get concept evaluations
            const conceptEvals = await repo.findConceptEvaluations(studentId, subjectData.syllabi);

            const conceptsCount = concepts.length;
            const conceptsMastered = conceptEvals.filter(e =>
                MASTERY_LEVEL_PERCENTAGES[e.level as MasteryLevel] >= 80
            ).length;

            // Build concepts array for UI
            const conceptsWithEval = concepts.map(concept => {
                const evaluation = conceptEvals.find(e =>
                    e.concept.toString() === concept._id.toString()
                );
                const conceptData = concept as unknown as Record<string, unknown>;
                return {
                    id: concept._id.toString(),
                    title: (conceptData.title as string) || (conceptData.name as string),
                    description: conceptData.description as string | undefined,
                    currentLevel: evaluation?.level,
                    lastEvaluated: evaluation?.evaluatedAt?.toISOString()
                };
            });

            subjects.push({
                id: subjectId,
                name: subjectData.name,
                description: subjectData.description,
                averageScore: Math.round(averageScore * 10) / 10,
                conceptsCount,
                conceptsMastered,
                trend,
                concepts: conceptsWithEval
            });
        }

        return subjects;
    }

    /**
     * Get student's rankings across all leaderboards
     */
    static async getStudentRankings(studentId: string) {
        const classRepo = new ClassRepository();

        // Find student's class using Repository
        const studentClass = await classRepo.findStudentClass(studentId);

        if (!studentClass) {
            return {};
        }

        // Delegate to LeaderboardService for leaderboard logic
        // Note: LeaderboardService still accesses DB directly for complex leaderboard calculations
        // but we've at least used Repository for the initial class lookup
        const studentClassData = studentClass as unknown as Record<string, unknown>;
        const result: {
            class?: Record<string, unknown>;
            school?: Record<string, unknown>;
            national?: Record<string, unknown>;
        } = {};

        // Class ranking
        try {
            const classId = (studentClassData._id as { toString: () => string }).toString();
            const classLeaderboard = await LeaderboardService.getClassLeaderboard(
                classId,
                studentId
            );
            if (classLeaderboard.currentUserPosition) {
                result.class = {
                    ...classLeaderboard.currentUserPosition,
                    className: studentClassData.name as string,
                    totalStudents: classLeaderboard.totalParticipants
                };
            }
        } catch (e) {
            console.error('Error getting class ranking', e);
        }

        // School level ranking
        try {
            const school = studentClassData.school as Record<string, unknown>;
            const level = studentClassData.level as { toString: () => string };
            const schoolId = (school._id as { toString: () => string }).toString();
            const levelId = level.toString();
            
            const schoolLeaderboard = await LeaderboardService.getSchoolLevelLeaderboard(
                schoolId,
                levelId,
                studentId
            );
            if (schoolLeaderboard.currentUserPosition) {
                result.school = {
                    ...schoolLeaderboard.currentUserPosition,
                    schoolName: school.name as string,
                    totalStudents: schoolLeaderboard.totalParticipants
                };
            }
        } catch (e) {
            console.error('Error getting school ranking', e);
        }

        // National ranking
        try {
            const level = studentClassData.level as { toString: () => string };
            const levelId = level.toString();
            
            const nationalLeaderboard = await LeaderboardService.getNationalLevelLeaderboard(
                levelId,
                studentId
            );
            if (nationalLeaderboard.currentUserPosition) {
                result.national = {
                    ...nationalLeaderboard.currentUserPosition,
                    totalStudents: nationalLeaderboard.totalParticipants
                };
            }
        } catch (e) {
            console.error('Error getting national ranking', e);
        }

        return result;
    }

    /**
     * Get student's learner profile
     */
    static async getStudentProfile(studentId: string): Promise<ILearnerProfile | null> {
        const repo = new LearnerProfileRepository();
        return await repo.findByUserIdBasic(studentId);
    }

    /**
     * Get orientation schools (validated schools for student orientation)
     * Returns schools from DB or fallback to mocks if DB unavailable
     */
    static async getOrientationSchools(search?: string): Promise<{
        data: Array<{
            _id: string;
            name: string;
            type: string;
            address?: string;
            logoUrl?: string;
            status: string;
            contactInfo?: Record<string, unknown>;
        }>;
        meta?: { source: string };
    }> {
        try {
            const repo = new SchoolRepository();
            const schools = await repo.findValidatedSchoolsForOrientation(search);

            const dto = schools.map((s) => ({
                _id: (s._id as { toString: () => string }).toString(),
                name: s.name as string,
                type: s.type as string,
                address: s.address as string | undefined,
                logoUrl: s.logoUrl as string | undefined,
                status: s.status as string,
                contactInfo: s.contactInfo as Record<string, unknown> | undefined,
            }));

            return { data: dto };
        } catch (error) {
            console.error("[Student Service] Error fetching orientation schools, using mocks:", error);

            // Fallback to mocks if DB is unavailable
            const filtered = search
                ? ORIENTATION_SCHOOLS_MOCK.filter((s) =>
                    s.name.toLowerCase().includes(search.toLowerCase())
                )
                : ORIENTATION_SCHOOLS_MOCK;

            return {
                data: filtered.map(s => ({
                    _id: s._id,
                    name: s.name,
                    type: s.type,
                    address: s.address,
                    logoUrl: s.logoUrl,
                    status: s.status || 'VALIDATED',
                    contactInfo: s.contactInfo
                })),
                meta: { source: "mock" }
            };
        }
    }

    /**
     * Get leaderboard based on type (CLASS, SCHOOL_LEVEL, NATIONAL_LEVEL)
     */
    static async getLeaderboard(
        studentId: string,
        type: LeaderboardType | string,
        metric: LeaderboardMetric | string
    ) {
        const classRepo = new ClassRepository();

        // Find student's class using Repository
        const studentClass = await classRepo.findStudentClass(studentId);

        if (!studentClass) {
            return null;
        }

        const studentClassData = studentClass as unknown as Record<string, unknown>;
        const classId = (studentClassData._id as { toString: () => string }).toString();
        const school = studentClassData.school as Record<string, unknown>;
        const level = studentClassData.level as { toString: () => string };

        // Convert string to enum if needed
        const leaderboardType = type as LeaderboardType;
        const leaderboardMetric = (metric as LeaderboardMetric) || LeaderboardMetric.XP;

        // Delegate to LeaderboardService based on type
        switch (leaderboardType) {
            case LeaderboardType.CLASS:
                return await LeaderboardService.getClassLeaderboard(
                    classId,
                    studentId,
                    leaderboardMetric
                );

            case LeaderboardType.SCHOOL_LEVEL:
                const schoolId = (school._id as { toString: () => string }).toString();
                const levelId = level.toString();
                return await LeaderboardService.getSchoolLevelLeaderboard(
                    schoolId,
                    levelId,
                    studentId,
                    leaderboardMetric
                );

            case LeaderboardType.NATIONAL_LEVEL:
                const nationalLevelId = level.toString();
                return await LeaderboardService.getNationalLevelLeaderboard(
                    nationalLevelId,
                    studentId,
                    leaderboardMetric
                );

            default:
                return await LeaderboardService.getClassLeaderboard(
                    classId,
                    studentId,
                    leaderboardMetric
                );
        }
    }

    /**
     * Get gamification stats for a student
     */
    static async getGamificationStats(studentId: string) {
        return await GamificationService.getUserStats(studentId);
    }

    /**
     * Get all exams available for a student
     * Returns exams from all classes where the student is enrolled
     */
    static async getStudentExams(studentId: string) {
        const classRepo = new ClassRepository();

        // 1. Get classes where student is enrolled using Repository
        const classes = await classRepo.findStudentClasses(studentId);

        // 2. Get exams for each class
        const allExams: Array<Record<string, unknown> & { _id: { toString: () => string }; startTime: Date | string }> = [];
        for (const cls of classes) {
            const classData = cls as unknown as Record<string, unknown>;
            const classId = (classData._id as { toString: () => string }).toString();
            // getClassExams logic handles checking targetLevels, targetFields, etc.
            const classExams = await ClassService.getClassExams(classId);
            allExams.push(...classExams as Array<Record<string, unknown> & { _id: { toString: () => string }; startTime: Date | string }>);
        }

        // 3. Deduplicate by ID
        const uniqueExams = Array.from(
            new Map(allExams.map(e => [e._id.toString(), e])).values()
        );

        // 4. Sort by startTime descending
        uniqueExams.sort((a, b) => {
            const aTime = typeof a.startTime === 'string' ? new Date(a.startTime).getTime() : a.startTime.getTime();
            const bTime = typeof b.startTime === 'string' ? new Date(b.startTime).getTime() : b.startTime.getTime();
            return bTime - aTime;
        });

        // 5. Format response with id field
        return uniqueExams.map(e => ({
            ...e,
            id: e._id.toString()
        }));
    }

    /**
     * Get all active classes the student is enrolled in with rankings
     */
    static async getStudentClasses(studentId: string): Promise<StudentClassWithRank[]> {
        const classRepo = new ClassRepository();

        // 1. Get active classes where student is enrolled using Repository
        const classes = await classRepo.findActiveStudentClasses(studentId);

        // 2. Get rankings for each class
        const classesWithRanks = await Promise.all(
            classes.map(async (cls) => {
                const classData = cls as unknown as Record<string, unknown>;
                const classId = (classData._id as { toString: () => string }).toString();
                let myRank: number | undefined;
                let myAverage: number | undefined;

                try {
                    const leaderboard = await LeaderboardService.getClassLeaderboard(
                        classId,
                        studentId
                    );
                    if (leaderboard.currentUserPosition) {
                        myRank = leaderboard.currentUserPosition.rank;
                    }
                    const myEntry = leaderboard.entries.find(e => e.isCurrentUser);
                    if (myEntry) {
                        myAverage = myEntry.score;
                    }
                } catch (error) {
                    console.error('Error getting class leaderboard:', error);
                }

                const school = classData.school as Record<string, unknown> | null;
                const level = classData.level as Record<string, unknown> | null;
                const field = classData.field as Record<string, unknown> | null;
                const mainTeacher = classData.mainTeacher as Record<string, unknown> | null;
                const students = classData.students as Array<unknown> | null;

                return {
                    id: classId,
                    name: (classData.name as string) || '',
                    schoolName: (school?.name as string) || 'École inconnue',
                    schoolLogo: school?.logoUrl as string | undefined,
                    level: (level?.name as string) || 'Niveau',
                    field: field?.name as string | undefined,
                    mainTeacher: {
                        name: (mainTeacher?.name as string) || 'Enseignant'
                    },
                    studentCount: students?.length || 0,
                    academicYear: (classData.academicYear as string) || '',
                    myRank,
                    myAverage
                };
            })
        );

        return classesWithRanks;
    }

    /**
     * Get all available and participated challenges for a student
     */
    static async getStudentChallenges(studentId: string) {
        const classRepo = new ClassRepository();
        const challengeRepo = new ChallengeRepository();

        // 1. Find student's class using Repository
        const studentClass = await classRepo.findStudentClass(studentId);

        const classId = studentClass ? (studentClass as unknown as Record<string, unknown>)._id?.toString() || null : null;
        const schoolId = studentClass ? (studentClass as unknown as Record<string, unknown>).school 
            ? ((studentClass as unknown as Record<string, unknown>).school as Record<string, unknown>)._id?.toString() || null
            : null : null;
        const levelId = studentClass ? (studentClass as unknown as Record<string, unknown>).level
            ? ((studentClass as unknown as Record<string, unknown>).level as Record<string, unknown>)._id?.toString() || null
            : null : null;

        // 2. Get accessible challenges using Repository
        const challenges = await challengeRepo.findAccessibleChallenges(
            classId,
            schoolId,
            levelId,
            [ChallengeStatus.ACTIVE, ChallengeStatus.UPCOMING],
            20
        );

        // 3. Get student's progress for each challenge
        const challengeIds = challenges.map(c => c._id as mongoose.Types.ObjectId);
        const progressRecords = await challengeRepo.findStudentProgress(studentId, challengeIds);

        const progressMap = new Map(
            progressRecords.map(p => [p.challengeId.toString(), p])
        );

        // 4. Format challenges with progress
        const formattedChallenges = challenges.map(challenge => {
            const challengeData = challenge as unknown as Record<string, unknown>;
            const progress = progressMap.get(challengeData._id?.toString() || '');

            const rewards = challengeData.rewards as Record<string, unknown>;
            const badgeId = rewards.badgeId as Record<string, unknown> | null;

            return {
                id: challengeData._id?.toString() || '',
                title: challengeData.title as string,
                description: challengeData.description as string,
                type: challengeData.type as string,
                status: challengeData.status as string,
                startDate: challengeData.startDate as Date,
                endDate: challengeData.endDate as Date,
                goals: challengeData.goals as Array<unknown>,
                rewards: {
                    xpBonus: rewards.xpBonus as number,
                    badgeName: badgeId?.name as string | undefined,
                    specialReward: rewards.specialReward as string | undefined
                },
                progress: progress ? {
                    progress: (progress as unknown as { progress: unknown; overallProgress: unknown; completed: unknown }).progress,
                    overallProgress: (progress as unknown as { progress: unknown; overallProgress: unknown; completed: unknown }).overallProgress,
                    completed: (progress as unknown as { progress: unknown; overallProgress: unknown; completed: unknown }).completed
                } : null,
                participantsCount: (challengeData.participants as Array<unknown>)?.length || 0,
                completedCount: (challengeData.completedBy as Array<unknown>)?.length || 0
            };
        });

        return formattedChallenges;
    }

    /**
     * Get all completed attempts for a student with exam details and results lock status
     */
    static async getStudentAttempts(studentId: string) {
        const attemptRepo = new AttemptRepository();
        const examRepo = new ExamRepository();

        // 1. Fetch completed attempts using Repository
        const attemptsDoc = await attemptRepo.findCompletedAttempts(studentId);

        // 2. Get unique exam IDs
        const examIds = [...new Set(attemptsDoc.map(a => a.examId.toString()))];

        // 3. Fetch exams using Repository
        const exams = await examRepo.findByIds(examIds);
        const examsMap = new Map(exams.map(e => [e._id.toString(), e]));

        const now = new Date();

        // 4. Format attempts with exam details and results lock status
        const data = attemptsDoc.map(a => {
            const attemptData = a as unknown as Record<string, unknown>;
            const exam = examsMap.get(attemptData.examId?.toString() || '');

            if (!exam) return null;

            const examData = exam as unknown as Record<string, unknown>;
            const config = examData.config as Record<string, unknown> | undefined;

            // Calculate if results are delayed due to late exam period
            const lateDuration = (config?.lateDuration as number) || 0;
            const delayResultsUntilLateEnd = (config?.delayResultsUntilLateEnd as boolean) ?? false;
            const examEndTime = examData.endTime ? new Date(examData.endTime as Date) : null;
            const lateEndTime = examEndTime ? addMinutes(examEndTime, lateDuration) : null;

            // Results are locked if:
            // 1. Exam hasn't ended yet, OR
            // 2. We're in late period AND delayResultsUntilLateEnd is enabled
            const examEnded = examEndTime ? isPast(examEndTime) : false;
            const inLatePeriod = lateEndTime ? isAfter(lateEndTime, now) && examEnded : false;
            const resultsLocked = !examEnded || (delayResultsUntilLateEnd && inLatePeriod && lateDuration > 0);

            // Time until results if locked due to late period
            const timeUntilResults = inLatePeriod && lateEndTime
                ? Math.ceil((lateEndTime.getTime() - now.getTime()) / 1000 / 60)
                : 0;

            return {
                ...attemptData,
                id: attemptData._id?.toString() || '',
                exam: {
                    ...examData,
                    id: examData._id?.toString() || ''
                },
                resultsLocked,
                inLatePeriod,
                timeUntilResults
            };
        }).filter(Boolean); // Filter out nulls

        return data;
    }

    /**
     * Get comprehensive analytics for a student
     * Aggregates data from PredictionEngine and AnalyticsEngine
     */
    static async getStudentAnalytics(studentId: string) {
        // Get prediction
        let prediction = null;
        try {
            const predictionData = await PredictionEngine.predictStudentScore(studentId);
            prediction = {
                predictedPercentage: predictionData.predictedPercentage,
                confidenceLevel: predictionData.confidenceLevel,
                trendDirection: predictionData.trendDirection,
                factors: predictionData.factors
            };
        } catch (error) {
            console.error('Error getting prediction:', error);
        }

        // Get success probability
        let successProbability = null;
        try {
            const probabilityData = await PredictionEngine.calculateSuccessProbability(studentId);
            successProbability = {
                probability: probabilityData.probability,
                riskLevel: probabilityData.riskLevel,
                recommendedActions: probabilityData.recommendedActions
            };
        } catch (error) {
            console.error('Error calculating success probability:', error);
        }

        // Get strengths and weaknesses
        let strengthsWeaknesses;
        try {
            strengthsWeaknesses = await AnalyticsEngine.identifyStrengthsAndWeaknesses(studentId);
        } catch (error) {
            console.error('Error identifying strengths/weaknesses:', error);
            strengthsWeaknesses = {
                strengths: [],
                weaknesses: [],
                overallLevel: 'UNKNOWN' as const,
                recommendations: []
            };
        }

        return {
            prediction,
            successProbability,
            strengths: strengthsWeaknesses.strengths,
            weaknesses: strengthsWeaknesses.weaknesses,
            overallLevel: strengthsWeaknesses.overallLevel,
            recommendations: strengthsWeaknesses.recommendations
        };
    }
}
