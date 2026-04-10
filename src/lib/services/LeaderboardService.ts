/**
 * LeaderboardService
 *
 * Gestion des classements multi-niveaux :
 * - Classement de classe (scoped aux examens de la classe)
 * - Classement d'école par niveau
 * - Classement national/application par niveau
 *
 * Optimisé : zéro requête N+1 — agrégations batch pour tous les niveaux.
 */

import mongoose from 'mongoose'

// ==========================================
// TYPES
// ==========================================

export interface LeaderboardEntry {
    rank: number
    studentId: string
    studentName: string
    avatarInitial: string
    /** Average score as percentage (0-100) or XP for national */
    score: number
    trend: 'UP' | 'DOWN' | 'STABLE' | 'NEW'
    previousRank?: number
    badges?: number
    level?: number
    examsCompleted?: number
    isCurrentUser?: boolean
}

export interface LeaderboardResult {
    type: LeaderboardType
    scope: {
        classId?: string
        className?: string
        schoolId?: string
        schoolName?: string
        levelId?: string
        levelName?: string
    }
    entries: LeaderboardEntry[]
    totalParticipants: number
    currentUserPosition?: {
        rank: number
        percentile: number
    }
    lastUpdated: Date
}

export enum LeaderboardType {
    CLASS = 'CLASS',
    SCHOOL_LEVEL = 'SCHOOL_LEVEL',
    NATIONAL_LEVEL = 'NATIONAL_LEVEL',
}

export enum LeaderboardMetric {
    XP = 'XP',
    EXAM_AVERAGE = 'EXAM_AVERAGE',
    EXAMS_COMPLETED = 'EXAMS_COMPLETED',
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Resolve the exam IDs that are visible to a given class,
 * mirroring the ClassService.getClassExams query logic.
 */
async function resolveClassExamIds(classId: string, classData: any): Promise<mongoose.Types.ObjectId[]> {
    const Exam = mongoose.models.Exam
    if (!Exam || !classData.level) return []

    const query: any = {
        targetLevels: { $in: [classData.level._id ?? classData.level] },
        status: 'PUBLISHED',
        isPublished: true,
    }

    if (classData.field) {
        const fieldIds = [classData.field._id ?? classData.field]
        if (classData.specialty) fieldIds.push(classData.specialty._id ?? classData.specialty)
        query.$or = [
            { targetFields: { $exists: false } },
            { targetFields: { $size: 0 } },
            { targetFields: { $in: fieldIds } },
        ]
    } else {
        query.$or = [
            { targetFields: { $exists: false } },
            { targetFields: { $size: 0 } },
        ]
    }

    const exams = await Exam.find(query).select('_id').lean()
    return exams.map((e: any) => e._id)
}

/**
 * Build ranked entries from a score map.
 * Students with 0 completed exams fall to the bottom with score = null display.
 */
function buildRankedEntries(
    students: Array<{ _id: mongoose.Types.ObjectId; name: string; gamification?: { totalXP?: number; level?: number } }>,
    scoreMap: Map<string, { total: number; count: number }>,
    currentUserId: string | undefined,
    metric: LeaderboardMetric,
): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = students.map((student) => {
        const sid = student._id.toString()
        const data = scoreMap.get(sid)

        let score = 0
        if (metric === LeaderboardMetric.XP) {
            score = student.gamification?.totalXP || 0
        } else if (metric === LeaderboardMetric.EXAMS_COMPLETED) {
            score = data?.count || 0
        } else {
            // EXAM_AVERAGE
            score = data && data.count > 0 ? data.total / data.count : 0
        }

        return {
            rank: 0,
            studentId: sid,
            studentName: student.name,
            avatarInitial: student.name?.[0]?.toUpperCase() || '?',
            score: Math.round(score * 10) / 10,
            trend: 'STABLE',
            level: student.gamification?.level || 1,
            examsCompleted: data?.count || 0,
            isCurrentUser: sid === currentUserId,
        }
    })

    // Sort: higher score first; ties go to those with more exams completed; zero-exam students last
    entries.sort((a, b) => {
        const aHas = (a.examsCompleted || 0) > 0
        const bHas = (b.examsCompleted || 0) > 0
        if (!aHas && !bHas) return 0
        if (!aHas) return 1
        if (!bHas) return -1
        return b.score - a.score
    })

    entries.forEach((e, i) => { e.rank = i + 1 })
    return entries
}

function computeUserPosition(
    entries: LeaderboardEntry[],
    currentUserId: string | undefined,
): LeaderboardResult['currentUserPosition'] | undefined {
    if (!currentUserId) return undefined
    const userEntry = entries.find((e) => e.isCurrentUser)
    if (!userEntry) return undefined
    return {
        rank: userEntry.rank,
        percentile: Math.round(((entries.length - userEntry.rank + 1) / entries.length) * 100),
    }
}

// ==========================================
// LEADERBOARD SERVICE
// ==========================================

export class LeaderboardService {

    /**
     * Get class leaderboard.
     * Scores are averaged only over exams that belong to this class.
     * Uses a single aggregation — no N+1 queries.
     */
    static async getClassLeaderboard(
        classId: string,
        currentUserId?: string,
        metric: LeaderboardMetric = LeaderboardMetric.EXAM_AVERAGE,
    ): Promise<LeaderboardResult> {
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt
        const Exam = mongoose.models.Exam

        // 1. Fetch class with its students
        const classData = await Class.findById(classId)
            .populate('students', 'name gamification')
            .lean()
        if (!classData) throw new Error('Class not found')

        const students = ((classData as any).students || []) as Array<{
            _id: mongoose.Types.ObjectId
            name: string
            gamification?: { totalXP?: number; level?: number }
        }>

        const studentIds = students.map((s) => s._id)

        let scoreMap = new Map<string, { total: number; count: number }>()

        if (metric === LeaderboardMetric.EXAM_AVERAGE || metric === LeaderboardMetric.EXAMS_COMPLETED) {
            // 2a. Resolve exam IDs scoped to this class (matches ClassService.getClassExams logic)
            const examIds = await resolveClassExamIds(classId, classData)

            if (examIds.length > 0) {
                // 2b. Aggregate all completed attempts for these exams in one shot
                const agg = await Attempt.aggregate([
                    {
                        $match: {
                            userId: { $in: studentIds },
                            examId: { $in: examIds },
                            status: 'COMPLETED',
                        },
                    },
                    {
                        $group: {
                            _id: '$userId',
                            totalScore: {
                                $sum: {
                                    $multiply: [
                                        { $divide: ['$score', { $ifNull: ['$maxScore', 100] }] },
                                        100,
                                    ],
                                },
                            },
                            count: { $sum: 1 },
                        },
                    },
                ])

                for (const row of agg) {
                    scoreMap.set(row._id.toString(), { total: row.totalScore, count: row.count })
                }
            }
        }
        // XP: handled in buildRankedEntries from student.gamification

        const entries = buildRankedEntries(students, scoreMap, currentUserId, metric)
        const currentUserPosition = computeUserPosition(entries, currentUserId)

        return {
            type: LeaderboardType.CLASS,
            scope: { classId, className: (classData as any).name },
            entries: entries.slice(0, 100),
            totalParticipants: entries.length,
            currentUserPosition,
            lastUpdated: new Date(),
        }
    }

    /**
     * Get school leaderboard for a specific level.
     * Uses a single aggregation across all students — no N+1.
     */
    static async getSchoolLevelLeaderboard(
        schoolId: string,
        levelId: string,
        currentUserId?: string,
        metric: LeaderboardMetric = LeaderboardMetric.EXAM_AVERAGE,
    ): Promise<LeaderboardResult> {
        const School = mongoose.models.School
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt
        const EducationLevel = mongoose.models.EducationLevel

        const [school, level] = await Promise.all([
            School.findById(schoolId).lean(),
            EducationLevel.findById(levelId).lean(),
        ])
        if (!school) throw new Error('School not found')

        // Get all active classes in this school at this level (with students)
        const classes = await Class.find({ school: schoolId, level: levelId, isActive: true })
            .populate('students', 'name gamification')
            .lean()

        // Deduplicate students across classes
        const studentMap = new Map<string, { _id: mongoose.Types.ObjectId; name: string; gamification?: { totalXP?: number; level?: number } }>()
        for (const cls of classes) {
            for (const s of ((cls as any).students || []) as any[]) {
                const sid = s._id.toString()
                if (!studentMap.has(sid)) studentMap.set(sid, s)
            }
        }
        const students = Array.from(studentMap.values())
        const studentIds = students.map((s) => s._id)

        const scoreMap = new Map<string, { total: number; count: number }>()

        if (metric === LeaderboardMetric.EXAM_AVERAGE || metric === LeaderboardMetric.EXAMS_COMPLETED) {
            const agg = await Attempt.aggregate([
                {
                    $match: {
                        userId: { $in: studentIds },
                        status: 'COMPLETED',
                    },
                },
                {
                    $group: {
                        _id: '$userId',
                        totalScore: {
                            $sum: {
                                $multiply: [
                                    { $divide: ['$score', { $ifNull: ['$maxScore', 100] }] },
                                    100,
                                ],
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ])
            for (const row of agg) {
                scoreMap.set(row._id.toString(), { total: row.totalScore, count: row.count })
            }
        }

        const entries = buildRankedEntries(students, scoreMap, currentUserId, metric)
        const currentUserPosition = computeUserPosition(entries, currentUserId)

        return {
            type: LeaderboardType.SCHOOL_LEVEL,
            scope: {
                schoolId,
                schoolName: (school as any).name,
                levelId,
                levelName: (level as any)?.name || 'Niveau',
            },
            entries: entries.slice(0, 100),
            totalParticipants: entries.length,
            currentUserPosition,
            lastUpdated: new Date(),
        }
    }

    /**
     * Get national leaderboard for a specific level.
     * Uses XP by default (gamification), with EXAM_AVERAGE as fallback.
     * Single aggregation — no N+1.
     */
    static async getNationalLevelLeaderboard(
        levelId: string,
        currentUserId?: string,
        metric: LeaderboardMetric = LeaderboardMetric.XP,
        limit = 100,
    ): Promise<LeaderboardResult> {
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt
        const EducationLevel = mongoose.models.EducationLevel

        const level = await EducationLevel.findById(levelId).lean()

        const classes = await Class.find({ level: levelId, isActive: true })
            .populate('students', 'name gamification')
            .lean()

        const studentMap = new Map<string, { _id: mongoose.Types.ObjectId; name: string; gamification?: { totalXP?: number; level?: number } }>()
        for (const cls of classes) {
            for (const s of ((cls as any).students || []) as any[]) {
                const sid = s._id.toString()
                if (!studentMap.has(sid)) studentMap.set(sid, s)
            }
        }
        const students = Array.from(studentMap.values())
        const studentIds = students.map((s) => s._id)

        const scoreMap = new Map<string, { total: number; count: number }>()

        if (metric === LeaderboardMetric.EXAM_AVERAGE || metric === LeaderboardMetric.EXAMS_COMPLETED) {
            const agg = await Attempt.aggregate([
                {
                    $match: {
                        userId: { $in: studentIds },
                        status: 'COMPLETED',
                    },
                },
                {
                    $group: {
                        _id: '$userId',
                        totalScore: {
                            $sum: {
                                $multiply: [
                                    { $divide: ['$score', { $ifNull: ['$maxScore', 100] }] },
                                    100,
                                ],
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ])
            for (const row of agg) {
                scoreMap.set(row._id.toString(), { total: row.totalScore, count: row.count })
            }
        }
        // XP: resolved in buildRankedEntries from student.gamification.totalXP

        const entries = buildRankedEntries(students, scoreMap, currentUserId, metric)
        const currentUserPosition = computeUserPosition(entries, currentUserId)

        return {
            type: LeaderboardType.NATIONAL_LEVEL,
            scope: {
                levelId,
                levelName: (level as any)?.name || 'Niveau',
            },
            entries: entries.slice(0, limit),
            totalParticipants: entries.length,
            currentUserPosition,
            lastUpdated: new Date(),
        }
    }

    /**
     * Get student's position across all leaderboards.
     * Reuses the optimized methods above.
     */
    static async getStudentAllRankings(studentId: string): Promise<{
        class?: LeaderboardResult['currentUserPosition'] & { className: string; totalStudents: number }
        school?: LeaderboardResult['currentUserPosition'] & { schoolName: string; totalStudents: number }
        national?: LeaderboardResult['currentUserPosition'] & { totalStudents: number }
    }> {
        const Class = mongoose.models.Class

        const studentClass = await Class.findOne({ students: studentId, isActive: true })
            .populate('school', 'name')
            .lean()

        if (!studentClass) return {}

        const classId = (studentClass as any)._id.toString()
        const school = (studentClass as any).school
        const levelId = (studentClass as any).level?.toString()

        const result: any = {}

        await Promise.all([
            // Class ranking
            this.getClassLeaderboard(classId, studentId, LeaderboardMetric.EXAM_AVERAGE)
                .then((lb) => {
                    if (lb.currentUserPosition) {
                        result.class = {
                            ...lb.currentUserPosition,
                            className: (studentClass as any).name,
                            totalStudents: lb.totalParticipants,
                        }
                    }
                })
                .catch((e) => console.error('Error getting class ranking', e)),

            // School ranking
            school?._id && levelId
                ? this.getSchoolLevelLeaderboard(
                    school._id.toString(),
                    levelId,
                    studentId,
                    LeaderboardMetric.EXAM_AVERAGE,
                )
                    .then((lb) => {
                        if (lb.currentUserPosition) {
                            result.school = {
                                ...lb.currentUserPosition,
                                schoolName: school.name,
                                totalStudents: lb.totalParticipants,
                            }
                        }
                    })
                    .catch((e) => console.error('Error getting school ranking', e))
                : Promise.resolve(),

            // National ranking
            levelId
                ? this.getNationalLevelLeaderboard(levelId, studentId, LeaderboardMetric.EXAM_AVERAGE)
                    .then((lb) => {
                        if (lb.currentUserPosition) {
                            result.national = {
                                ...lb.currentUserPosition,
                                totalStudents: lb.totalParticipants,
                            }
                        }
                    })
                    .catch((e) => console.error('Error getting national ranking', e))
                : Promise.resolve(),
        ])

        return result
    }
}
