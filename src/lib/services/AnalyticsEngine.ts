/**
 * AnalyticsEngine
 *
 * Moteur d'analyse avancée pour :
 * - Analyses comparatives intra et inter-établissements
 * - Identification des forces et faiblesses
 * - Benchmarking multi-niveaux
 * - Rapports statistiques détaillés
 * - Corrélations et insights
 *
 * Utilise simple-statistics pour des calculs statistiques précis
 */

import mongoose from 'mongoose'
import * as ss from 'simple-statistics'
import { MasteryLevel, MASTERY_LEVEL_PERCENTAGES } from '@/lib/patterns/EvaluationStrategy'

// ==========================================
// TYPES
// ==========================================

export interface StudentStrengthWeakness {
    studentId: string
    strengths: SubjectPerformance[]
    weaknesses: SubjectPerformance[]
    overallLevel: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT' | 'CRITICAL'
    recommendations: string[]
}

export interface SubjectPerformance {
    subjectId: string
    subjectName: string
    averageScore: number
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
    masteryLevel: MasteryLevel
    conceptsCount: number
    conceptsMastered: number
    passRate?: number
    examCount?: number
}

export interface ClassComparison {
    classId: string
    className: string
    averageScore: number
    medianScore: number
    standardDeviation: number
    passRate: number
    topPerformersCount: number
    atRiskCount: number
    rank?: number
    percentile?: number
}

export interface SchoolComparison {
    schoolId: string
    schoolName: string
    region?: string
    averageScore: number
    passRate: number
    studentCount: number
    classCount: number
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
    nationalPercentile?: number
    regionalPercentile?: number
}

export interface SubjectAnalysis {
    subjectId: string
    subjectName: string
    classAverage: number
    schoolAverage: number
    nationalAverage?: number
    difficultyIndex: number // 0-100, higher = harder
    discriminationIndex: number // How well it differentiates students
    commonErrors: ErrorPattern[]
}

export interface ErrorPattern {
    conceptId: string
    conceptTitle: string
    errorRate: number
    commonMistakes: string[]
    recommendation: string
}

export interface ProgressionReport {
    studentId: string
    period: string
    startDate: Date
    endDate: Date
    metrics: {
        averageScore: { start: number; end: number; change: number }
        examsTaken: number
        conceptsEvaluated: number
        masteryGained: number
        consistencyScore: number // 0-100
    }
    milestones: Milestone[]
    alerts: Alert[]
}

export interface Milestone {
    type: 'FIRST_PASS' | 'IMPROVEMENT' | 'MASTERY' | 'STREAK' | 'RECOVERY'
    description: string
    date: Date
    value?: number
}

export interface Alert {
    type: 'DECLINE' | 'INACTIVITY' | 'STRUGGLE' | 'INCONSISTENCY'
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    message: string
    recommendation: string
}

export interface CohortAnalysis {
    cohortId: string
    cohortName: string
    size: number
    demographics: {
        byGender?: Record<string, number>
        byLevel?: Record<string, number>
        byField?: Record<string, number>
    }
    performance: {
        average: number
        median: number
        standardDeviation: number
        quartiles: [number, number, number]
        distribution: DistributionBucket[]
    }
    comparison?: {
        toPreviousCohort?: { difference: number; significant: boolean }
        toNational?: { percentile: number }
    }
}

export interface DistributionBucket {
    range: string
    min: number
    max: number
    count: number
    percentage: number
}

export interface CorrelationInsight {
    factor1: string
    factor2: string
    correlation: number // -1 to 1
    significance: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
    interpretation: string
}

// ==========================================
// ANALYTICS ENGINE
// ==========================================

export class AnalyticsEngine {

    /**
     * Identify strengths and weaknesses for a student
     */
    static async identifyStrengthsAndWeaknesses(
        studentId: string
    ): Promise<StudentStrengthWeakness> {
        const Attempt = mongoose.models.Attempt
        const Subject = mongoose.models.Subject
        const ConceptEvaluation = mongoose.models.ConceptEvaluation

        // Get all attempts grouped by subject
        const attempts = await Attempt.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(studentId), status: 'COMPLETED' } },
            {
                $lookup: {
                    from: 'exams',
                    localField: 'exam',
                    foreignField: '_id',
                    as: 'examData'
                }
            },
            { $unwind: '$examData' },
            {
                $group: {
                    _id: '$examData.subject',
                    attempts: { $push: '$$ROOT' },
                    avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
                    count: { $sum: 1 }
                }
            }
        ])

        // Enrich with subject data and calculate trends
        const performances: SubjectPerformance[] = []

        for (const group of attempts) {
            const subject = await Subject.findById(group._id).lean()
            if (!subject) continue

            const scores = group.attempts.map((a: any) =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            ).sort((a: number, b: number) =>
                new Date(group.attempts.find((at: any) =>
                    ((at.score || 0) / (at.maxScore || 100)) * 100 === a
                )?.submittedAt || 0).getTime() -
                new Date(group.attempts.find((at: any) =>
                    ((at.score || 0) / (at.maxScore || 100)) * 100 === b
                )?.submittedAt || 0).getTime()
            )

            // Calculate trend
            let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE'
            if (scores.length >= 3) {
                const firstHalf = ss.mean(scores.slice(0, Math.floor(scores.length / 2)))
                const secondHalf = ss.mean(scores.slice(Math.floor(scores.length / 2)))
                if (secondHalf > firstHalf + 5) trend = 'IMPROVING'
                else if (secondHalf < firstHalf - 5) trend = 'DECLINING'
            }

            // Get concept evaluations for this subject
            let conceptsCount = 0
            let conceptsMastered = 0

            if (ConceptEvaluation) {
                const conceptEvals = await ConceptEvaluation.find({
                    student: new mongoose.Types.ObjectId(studentId)
                }).populate({
                    path: 'concept',
                    populate: { path: 'syllabus', match: { subject: group._id } }
                }).lean()

                const relevantEvals = conceptEvals.filter((e: any) => e.concept?.syllabus)
                conceptsCount = relevantEvals.length
                conceptsMastered = relevantEvals.filter((e: any) =>
                    MASTERY_LEVEL_PERCENTAGES[e.level as MasteryLevel] >= 80
                ).length
            }

            // Determine mastery level
            const avgScore = group.avgScore
            let masteryLevel: MasteryLevel
            if (avgScore >= 90) masteryLevel = MasteryLevel.PERFECTLY_ABLE
            else if (avgScore >= 75) masteryLevel = MasteryLevel.ABLE_ALONE
            else if (avgScore >= 60) masteryLevel = MasteryLevel.ABLE_WITH_HELP
            else if (avgScore >= 45) masteryLevel = MasteryLevel.UNABLE_ALONE
            else if (avgScore >= 30) masteryLevel = MasteryLevel.UNABLE_WITH_HELP
            else masteryLevel = MasteryLevel.TOTALLY_UNABLE

            performances.push({
                subjectId: group._id.toString(),
                subjectName: (subject as any).name,
                averageScore: Math.round(avgScore * 10) / 10,
                trend,
                masteryLevel,
                conceptsCount,
                conceptsMastered
            })
        }

        // Sort by score to identify strengths and weaknesses
        const sorted = [...performances].sort((a, b) => b.averageScore - a.averageScore)
        const strengths = sorted.filter(p => p.averageScore >= 70).slice(0, 3)
        const weaknesses = sorted.filter(p => p.averageScore < 60).slice(-3).reverse()

        // Determine overall level
        const overallAvg = performances.length > 0
            ? ss.mean(performances.map(p => p.averageScore))
            : 0

        let overallLevel: StudentStrengthWeakness['overallLevel']
        if (overallAvg >= 85) overallLevel = 'EXCELLENT'
        else if (overallAvg >= 70) overallLevel = 'GOOD'
        else if (overallAvg >= 55) overallLevel = 'AVERAGE'
        else if (overallAvg >= 40) overallLevel = 'NEEDS_IMPROVEMENT'
        else overallLevel = 'CRITICAL'

        // Generate recommendations
        const recommendations: string[] = []
        if (weaknesses.length > 0) {
            recommendations.push(`Priorité : améliorer vos résultats en ${weaknesses[0].subjectName}`)
            if (weaknesses[0].trend === 'DECLINING') {
                recommendations.push(`Attention : vos résultats en ${weaknesses[0].subjectName} sont en baisse`)
            }
        }
        if (strengths.length > 0 && strengths[0].trend === 'IMPROVING') {
            recommendations.push(`Excellent ! Continuez vos efforts en ${strengths[0].subjectName}`)
        }
        if (performances.some(p => p.conceptsMastered < p.conceptsCount / 2)) {
            recommendations.push('Travaillez sur la maîtrise des concepts fondamentaux')
        }

        return {
            studentId,
            strengths,
            weaknesses,
            overallLevel,
            recommendations
        }
    }

    /**
     * Compare classes within a school
     */
    static async compareClasses(
        schoolId: string,
        subjectId?: string
    ): Promise<ClassComparison[]> {
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt

        const classes = await Class.find({ school: new mongoose.Types.ObjectId(schoolId) }).lean()
        const comparisons: ClassComparison[] = []

        for (const cls of classes) {
            const studentIds = (cls as any).students || []
            if (studentIds.length === 0) continue

            const matchQuery: any = {
                userId: { $in: studentIds },
                status: 'COMPLETED'
            }

            // If subject specified, filter by subject
            if (subjectId) {
                const Exam = mongoose.models.Exam
                const examIds = await Exam.find({ subject: subjectId }).distinct('_id')
                matchQuery.exam = { $in: examIds }
            }

            const attempts = await Attempt.find(matchQuery).lean()

            if (attempts.length === 0) continue

            const scores = attempts.map(a =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            )

            const passRate = (scores.filter(s => s >= 50).length / scores.length) * 100
            const topPerformersCount = scores.filter(s => s >= 80).length
            const atRiskCount = scores.filter(s => s < 40).length

            comparisons.push({
                classId: (cls as any)._id.toString(),
                className: (cls as any).name,
                averageScore: Math.round(ss.mean(scores) * 10) / 10,
                medianScore: Math.round(ss.median(scores) * 10) / 10,
                standardDeviation: Math.round(ss.standardDeviation(scores) * 10) / 10,
                passRate: Math.round(passRate),
                topPerformersCount,
                atRiskCount
            })
        }

        // Sort by average score and assign ranks
        comparisons.sort((a, b) => b.averageScore - a.averageScore)
        comparisons.forEach((c, i) => {
            c.rank = i + 1
            c.percentile = Math.round(((comparisons.length - i) / comparisons.length) * 100)
        })

        return comparisons
    }

    /**
     * Compare schools regionally or nationally
     */
    static async compareSchools(
        schoolIds: string[],
        options: { includeNational?: boolean; region?: string } = {}
    ): Promise<SchoolComparison[]> {
        const School = mongoose.models.School
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt

        const comparisons: SchoolComparison[] = []
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const sixtyDaysAgo = new Date()
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

        for (const schoolId of schoolIds) {
            const school = await School.findById(schoolId).lean()
            if (!school) continue

            const classes = await Class.find({ school: schoolId }).lean()
            const allStudentIds = classes.flatMap((c: any) => c.students || [])

            // Recent attempts
            const recentAttempts = await Attempt.find({
                userId: { $in: allStudentIds },
                status: 'COMPLETED',
                submittedAt: { $gte: thirtyDaysAgo }
            }).lean()

            // Older attempts for trend
            const olderAttempts = await Attempt.find({
                userId: { $in: allStudentIds },
                status: 'COMPLETED',
                submittedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
            }).lean()

            if (recentAttempts.length === 0) continue

            const recentScores = recentAttempts.map(a =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            )
            const olderScores = olderAttempts.map(a =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            )

            const recentAvg = ss.mean(recentScores)
            const olderAvg = olderScores.length > 0 ? ss.mean(olderScores) : recentAvg

            let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE'
            if (recentAvg > olderAvg + 3) trend = 'IMPROVING'
            else if (recentAvg < olderAvg - 3) trend = 'DECLINING'

            comparisons.push({
                schoolId,
                schoolName: (school as any).name,
                region: (school as any).region,
                averageScore: Math.round(recentAvg * 10) / 10,
                passRate: Math.round((recentScores.filter(s => s >= 50).length / recentScores.length) * 100),
                studentCount: allStudentIds.length,
                classCount: classes.length,
                trend
            })
        }

        // Calculate percentiles
        comparisons.sort((a, b) => b.averageScore - a.averageScore)
        const total = comparisons.length

        comparisons.forEach((c, i) => {
            c.nationalPercentile = Math.round(((total - i) / total) * 100)

            // Regional percentile if applicable
            if (c.region && options.region) {
                const regionalSchools = comparisons.filter(s => s.region === c.region)
                const regionalRank = regionalSchools.findIndex(s => s.schoolId === c.schoolId) + 1
                c.regionalPercentile = Math.round(((regionalSchools.length - regionalRank + 1) / regionalSchools.length) * 100)
            }
        })

        return comparisons
    }

    /**
     * Analyze subject performance at class level
     */
    static async analyzeSubjectPerformance(
        classId: string,
        subjectId: string
    ): Promise<SubjectAnalysis> {
        const Class = mongoose.models.Class
        const Subject = mongoose.models.Subject
        const Attempt = mongoose.models.Attempt
        const Exam = mongoose.models.Exam

        const classData = await Class.findById(classId).lean()
        const subject = await Subject.findById(subjectId).lean()

        if (!classData || !subject) {
            throw new Error('Class or Subject not found')
        }

        const studentIds = (classData as any).students || []

        // Get exams for this subject
        const exams = await Exam.find({ subject: subjectId }).lean()
        const examIds = exams.map((e: any) => e._id)

        // Get attempts for this class on this subject
        const attempts = await Attempt.find({
            userId: { $in: studentIds },
            exam: { $in: examIds },
            status: 'COMPLETED'
        }).lean()

        const scores = attempts.map(a =>
            ((a.score || 0) / (a.maxScore || 100)) * 100
        )

        const classAverage = scores.length > 0 ? ss.mean(scores) : 0

        // Calculate school average for comparison
        const schoolId = (classData as any).school
        const allClasses = await Class.find({ school: schoolId }).lean()
        const allStudentIds = allClasses.flatMap((c: any) => c.students || [])

        const schoolAttempts = await Attempt.find({
            userId: { $in: allStudentIds },
            exam: { $in: examIds },
            status: 'COMPLETED'
        }).lean()

        const schoolScores = schoolAttempts.map(a =>
            ((a.score || 0) / (a.maxScore || 100)) * 100
        )
        const schoolAverage = schoolScores.length > 0 ? ss.mean(schoolScores) : 0

        // Calculate difficulty index (based on pass rate)
        const passRate = scores.filter(s => s >= 50).length / Math.max(1, scores.length)
        const difficultyIndex = Math.round((1 - passRate) * 100)

        // Calculate discrimination index (how well it separates top/bottom performers)
        const sortedScores = [...scores].sort((a, b) => b - a)
        const topThird = sortedScores.slice(0, Math.floor(sortedScores.length / 3))
        const bottomThird = sortedScores.slice(-Math.floor(sortedScores.length / 3))

        const discriminationIndex = topThird.length > 0 && bottomThird.length > 0
            ? Math.round(((ss.mean(topThird) - ss.mean(bottomThird)) / 100) * 100)
            : 50

        // Analyze common errors (simplified - would need question-level data)
        const commonErrors: ErrorPattern[] = []

        return {
            subjectId,
            subjectName: (subject as any).name,
            classAverage: Math.round(classAverage * 10) / 10,
            schoolAverage: Math.round(schoolAverage * 10) / 10,
            difficultyIndex,
            discriminationIndex,
            commonErrors
        }
    }

    /**
     * Get global subject statistics for a teacher across all their classes
     */
    static async getTeacherGlobalSubjectStats(teacherId: string): Promise<SubjectPerformance[]> {
        const Class = mongoose.models.Class
        const Exam = mongoose.models.Exam
        const Attempt = mongoose.models.Attempt
        const Subject = mongoose.models.Subject

        // 1. Get all classes for this teacher
        const classes = await Class.find({ mainTeacher: new mongoose.Types.ObjectId(teacherId) }).lean()
        const classIds = classes.map((c: any) => c._id)
        const allStudentIds = classes.flatMap((c: any) => c.students || [])

        if (allStudentIds.length === 0) return []

        // 2. Get all exams created by this teacher OR used in these classes
        // For simplicity, let's look at attempts by these students on any exam linked to a subject

        // Aggregate attempts by subject
        const stats = await Attempt.aggregate([
            {
                $match: {
                    userId: { $in: allStudentIds },
                    status: 'COMPLETED'
                }
            },
            {
                $lookup: {
                    from: 'exams',
                    localField: 'exam',
                    foreignField: '_id',
                    as: 'examData'
                }
            },
            { $unwind: '$examData' },
            {
                $group: {
                    _id: '$examData.subject',
                    averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
                    totalAttempts: { $sum: 1 },
                    passedAttempts: {
                        $sum: {
                            $cond: [{ $gte: [{ $divide: ['$score', '$maxScore'] }, 0.5] }, 1, 0]
                        }
                    },
                    scores: { $push: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } } // For trend
                }
            }
        ])

        const results: SubjectPerformance[] = []

        for (const stat of stats) {
            const subject = await Subject.findById(stat._id).lean()
            if (!subject) continue

            const passRate = Math.round((stat.passedAttempts / stat.totalAttempts) * 100)

            // Calculate trend (simplified)
            // Ideally we'd sort by date, but aggregate grouped everything. 
            // We can check if we have enough data or just default to STABLE for now if dates aren't preserved readily in this group
            // A better way for trend is to query separately or keep dates in array.
            // Let's keep it 'STABLE' for now unless we do a time-series aggregation.
            // Actually, let's try to infer trend from the scores array if we assume they are roughly chronological or random? No, that's bad.
            // Let's separate trend calculation.

            results.push({
                subjectId: stat._id.toString(),
                subjectName: (subject as any).name,
                averageScore: Math.round(stat.averageScore * 10) / 10,
                trend: 'STABLE', // Placeholder, implementing real trend would require heavier query
                masteryLevel: MasteryLevel.UNKNOWN, // Not calculated here
                conceptsCount: 0,
                conceptsMastered: 0,
                passRate: passRate,
                examCount: stat.totalAttempts
            })
        }

        return results
    }

    /**
     * Generate progression report for a student
     */
    static async generateProgressionReport(
        studentId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ProgressionReport> {
        const Attempt = mongoose.models.Attempt
        const ConceptEvaluation = mongoose.models.ConceptEvaluation

        // Get attempts in the period
        const attempts = await Attempt.find({
            userId: new mongoose.Types.ObjectId(studentId),
            status: 'COMPLETED',
            submittedAt: { $gte: startDate, $lte: endDate }
        }).sort({ submittedAt: 1 }).lean()

        const scores = attempts.map(a =>
            ((a.score || 0) / (a.maxScore || 100)) * 100
        )

        // Calculate metrics
        const firstHalfScores = scores.slice(0, Math.ceil(scores.length / 2))
        const secondHalfScores = scores.slice(Math.ceil(scores.length / 2))

        const startAvg = firstHalfScores.length > 0 ? ss.mean(firstHalfScores) : 0
        const endAvg = secondHalfScores.length > 0 ? ss.mean(secondHalfScores) : startAvg

        // Consistency score based on standard deviation
        const stdDev = scores.length > 1 ? ss.standardDeviation(scores) : 0
        const consistencyScore = Math.max(0, Math.round(100 - stdDev * 2))

        // Concept evaluations
        let conceptsEvaluated = 0
        let masteryGained = 0

        if (ConceptEvaluation) {
            const evals = await ConceptEvaluation.find({
                student: new mongoose.Types.ObjectId(studentId),
                evaluatedAt: { $gte: startDate, $lte: endDate }
            }).lean()

            conceptsEvaluated = evals.length
            masteryGained = evals.filter((e: any) =>
                MASTERY_LEVEL_PERCENTAGES[e.level as MasteryLevel] >= 80
            ).length
        }

        // Identify milestones
        const milestones: Milestone[] = []

        // First pass milestone
        const firstPass = attempts.find(a =>
            ((a.score || 0) / (a.maxScore || 100)) * 100 >= 50
        )
        if (firstPass) {
            milestones.push({
                type: 'FIRST_PASS',
                description: 'Première réussite à un examen',
                date: new Date(firstPass.submittedAt)
            })
        }

        // Improvement milestone
        if (endAvg > startAvg + 10) {
            milestones.push({
                type: 'IMPROVEMENT',
                description: `Amélioration de ${Math.round(endAvg - startAvg)}%`,
                date: endDate,
                value: Math.round(endAvg - startAvg)
            })
        }

        // Identify alerts
        const alerts: Alert[] = []

        // Decline alert
        if (endAvg < startAvg - 10) {
            alerts.push({
                type: 'DECLINE',
                severity: endAvg < startAvg - 20 ? 'HIGH' : 'MEDIUM',
                message: `Baisse des performances de ${Math.round(startAvg - endAvg)}%`,
                recommendation: 'Analysez les concepts difficiles et demandez de l\'aide'
            })
        }

        // Inactivity alert
        if (attempts.length < 3) {
            alerts.push({
                type: 'INACTIVITY',
                severity: attempts.length === 0 ? 'HIGH' : 'MEDIUM',
                message: 'Activité insuffisante sur la période',
                recommendation: 'Effectuez des évaluations régulières pour suivre votre progression'
            })
        }

        // Inconsistency alert
        if (consistencyScore < 50) {
            alerts.push({
                type: 'INCONSISTENCY',
                severity: consistencyScore < 30 ? 'HIGH' : 'MEDIUM',
                message: 'Résultats très variables',
                recommendation: 'Travaillez sur une préparation plus régulière'
            })
        }

        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const periodWeeks = Math.ceil(periodDays / 7)

        return {
            studentId,
            period: `${periodWeeks} semaines`,
            startDate,
            endDate,
            metrics: {
                averageScore: {
                    start: Math.round(startAvg * 10) / 10,
                    end: Math.round(endAvg * 10) / 10,
                    change: Math.round((endAvg - startAvg) * 10) / 10
                },
                examsTaken: attempts.length,
                conceptsEvaluated,
                masteryGained,
                consistencyScore
            },
            milestones,
            alerts
        }
    }

    /**
     * Analyze cohort performance
     */
    static async analyzeCohort(
        studentIds: string[],
        cohortName: string
    ): Promise<CohortAnalysis> {
        const Attempt = mongoose.models.Attempt
        const User = mongoose.models.User

        // Get all attempts for the cohort
        const objectIds = studentIds.map(id => new mongoose.Types.ObjectId(id))

        const attempts = await Attempt.find({
            userId: { $in: objectIds },
            status: 'COMPLETED'
        }).lean()

        // Calculate per-student averages
        const studentAverages: number[] = []
        const studentMap = new Map<string, number[]>()

        for (const attempt of attempts) {
            const score = ((attempt.score || 0) / (attempt.maxScore || 100)) * 100
            const sid = attempt.userId.toString()

            if (!studentMap.has(sid)) {
                studentMap.set(sid, [])
            }
            studentMap.get(sid)!.push(score)
        }

        for (const [, scores] of studentMap) {
            studentAverages.push(ss.mean(scores))
        }

        // Calculate distribution
        const distribution: DistributionBucket[] = [
            { range: '0-20%', min: 0, max: 20, count: 0, percentage: 0 },
            { range: '20-40%', min: 20, max: 40, count: 0, percentage: 0 },
            { range: '40-60%', min: 40, max: 60, count: 0, percentage: 0 },
            { range: '60-80%', min: 60, max: 80, count: 0, percentage: 0 },
            { range: '80-100%', min: 80, max: 100, count: 0, percentage: 0 },
        ]

        for (const avg of studentAverages) {
            const bucket = distribution.find(d => avg >= d.min && avg < d.max) ||
                distribution[distribution.length - 1]
            bucket.count++
        }

        const total = studentAverages.length
        distribution.forEach(d => {
            d.percentage = Math.round((d.count / Math.max(1, total)) * 100)
        })

        // Calculate quartiles
        const sorted = [...studentAverages].sort((a, b) => a - b)
        const q1 = ss.quantile(sorted, 0.25)
        const q2 = ss.quantile(sorted, 0.5)
        const q3 = ss.quantile(sorted, 0.75)

        return {
            cohortId: cohortName.toLowerCase().replace(/\s+/g, '-'),
            cohortName,
            size: studentIds.length,
            demographics: {},
            performance: {
                average: studentAverages.length > 0 ? Math.round(ss.mean(studentAverages) * 10) / 10 : 0,
                median: studentAverages.length > 0 ? Math.round(ss.median(studentAverages) * 10) / 10 : 0,
                standardDeviation: studentAverages.length > 1 ? Math.round(ss.standardDeviation(studentAverages) * 10) / 10 : 0,
                quartiles: [Math.round(q1), Math.round(q2), Math.round(q3)],
                distribution
            }
        }
    }

    /**
     * Find correlations between factors
     */
    static async findCorrelations(
        studentIds: string[]
    ): Promise<CorrelationInsight[]> {
        const Attempt = mongoose.models.Attempt
        const ConceptEvaluation = mongoose.models.ConceptEvaluation

        const insights: CorrelationInsight[] = []
        const objectIds = studentIds.map(id => new mongoose.Types.ObjectId(id))

        // Collect data for each student
        const studentData: Array<{
            avgScore: number
            attemptCount: number
            consistency: number
            selfEvalAvg: number
        }> = []

        for (const studentId of studentIds) {
            const attempts = await Attempt.find({
                userId: new mongoose.Types.ObjectId(studentId),
                status: 'COMPLETED'
            }).lean()

            const scores = attempts.map(a =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            )

            if (scores.length === 0) continue

            const avgScore = ss.mean(scores)
            const consistency = 100 - (ss.standardDeviation(scores) * 2)

            let selfEvalAvg = 50
            if (ConceptEvaluation) {
                const evals = await ConceptEvaluation.find({
                    student: new mongoose.Types.ObjectId(studentId)
                }).lean()

                if (evals.length > 0) {
                    selfEvalAvg = ss.mean(
                        evals.map((e: any) => MASTERY_LEVEL_PERCENTAGES[e.level as MasteryLevel] || 50)
                    )
                }
            }

            studentData.push({
                avgScore,
                attemptCount: attempts.length,
                consistency: Math.max(0, consistency),
                selfEvalAvg
            })
        }

        if (studentData.length < 5) {
            return insights // Not enough data for meaningful correlations
        }

        // Calculate correlations
        const avgScores = studentData.map(d => d.avgScore)
        const attemptCounts = studentData.map(d => d.attemptCount)
        const consistencies = studentData.map(d => d.consistency)
        const selfEvals = studentData.map(d => d.selfEvalAvg)

        // Practice vs Performance correlation
        const practiceCorr = ss.sampleCorrelation(attemptCounts, avgScores)
        insights.push({
            factor1: 'Nombre de pratiques',
            factor2: 'Performance moyenne',
            correlation: Math.round(practiceCorr * 100) / 100,
            significance: Math.abs(practiceCorr) > 0.7 ? 'HIGH' :
                Math.abs(practiceCorr) > 0.4 ? 'MEDIUM' :
                    Math.abs(practiceCorr) > 0.2 ? 'LOW' : 'NONE',
            interpretation: practiceCorr > 0.4
                ? 'La pratique régulière est fortement liée à de meilleurs résultats'
                : practiceCorr > 0.2
                    ? 'La pratique a un impact modéré sur les résultats'
                    : 'La quantité de pratique a peu d\'impact direct sur les résultats'
        })

        // Consistency vs Performance correlation
        const consistencyCorr = ss.sampleCorrelation(consistencies, avgScores)
        insights.push({
            factor1: 'Régularité des résultats',
            factor2: 'Performance moyenne',
            correlation: Math.round(consistencyCorr * 100) / 100,
            significance: Math.abs(consistencyCorr) > 0.7 ? 'HIGH' :
                Math.abs(consistencyCorr) > 0.4 ? 'MEDIUM' :
                    Math.abs(consistencyCorr) > 0.2 ? 'LOW' : 'NONE',
            interpretation: consistencyCorr > 0.4
                ? 'Les étudiants réguliers ont généralement de meilleurs résultats'
                : 'La régularité n\'est pas un facteur déterminant'
        })

        // Self-evaluation accuracy
        const selfEvalCorr = ss.sampleCorrelation(selfEvals, avgScores)
        insights.push({
            factor1: 'Auto-évaluation',
            factor2: 'Performance réelle',
            correlation: Math.round(selfEvalCorr * 100) / 100,
            significance: Math.abs(selfEvalCorr) > 0.7 ? 'HIGH' :
                Math.abs(selfEvalCorr) > 0.4 ? 'MEDIUM' :
                    Math.abs(selfEvalCorr) > 0.2 ? 'LOW' : 'NONE',
            interpretation: selfEvalCorr > 0.6
                ? 'Les auto-évaluations sont bien calibrées avec les performances réelles'
                : selfEvalCorr > 0.3
                    ? 'Corrélation modérée entre auto-évaluation et performance'
                    : 'Les auto-évaluations ne reflètent pas bien les performances réelles'
        })

        return insights
    }

    /**
     * Generate leaderboard for a class
     */
    static async generateLeaderboard(
        classId: string,
        options: { period?: 'week' | 'month' | 'all'; anonymize?: boolean } = {}
    ): Promise<Array<{
        rank: number
        studentId: string
        displayName: string
        score: number
        examsTaken: number
        trend: 'UP' | 'DOWN' | 'STABLE'
    }>> {
        const Class = mongoose.models.Class
        const User = mongoose.models.User
        const Attempt = mongoose.models.Attempt

        const classData = await Class.findById(classId).lean()
        if (!classData) throw new Error('Class not found')

        const studentIds = (classData as any).students || []
        const { period = 'month', anonymize = true } = options

        // Calculate date range
        const endDate = new Date()
        const startDate = new Date()
        if (period === 'week') startDate.setDate(startDate.getDate() - 7)
        else if (period === 'month') startDate.setDate(startDate.getDate() - 30)
        else startDate.setFullYear(2000) // All time

        const previousStartDate = new Date(startDate)
        const previousEndDate = new Date(startDate)
        if (period === 'week') previousStartDate.setDate(previousStartDate.getDate() - 7)
        else if (period === 'month') previousStartDate.setDate(previousStartDate.getDate() - 30)

        const leaderboard: Array<{
            rank: number
            studentId: string
            displayName: string
            score: number
            examsTaken: number
            trend: 'UP' | 'DOWN' | 'STABLE'
        }> = []

        for (const studentId of studentIds) {
            const user = await User.findById(studentId).lean()
            if (!user) continue

            // Current period attempts
            const currentAttempts = await Attempt.find({
                userId: studentId,
                status: 'COMPLETED',
                submittedAt: { $gte: startDate, $lte: endDate }
            }).lean()

            if (currentAttempts.length === 0) continue

            const currentScores = currentAttempts.map(a =>
                ((a.score || 0) / (a.maxScore || 100)) * 100
            )
            const currentAvg = ss.mean(currentScores)

            // Previous period for trend
            const previousAttempts = await Attempt.find({
                userId: studentId,
                status: 'COMPLETED',
                submittedAt: { $gte: previousStartDate, $lt: previousEndDate }
            }).lean()

            let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE'
            if (previousAttempts.length > 0) {
                const previousScores = previousAttempts.map(a =>
                    ((a.score || 0) / (a.maxScore || 100)) * 100
                )
                const previousAvg = ss.mean(previousScores)
                if (currentAvg > previousAvg + 3) trend = 'UP'
                else if (currentAvg < previousAvg - 3) trend = 'DOWN'
            }

            const displayName = anonymize
                ? `${(user as any).firstName?.[0] || 'A'}***`
                : `${(user as any).firstName} ${(user as any).lastName?.[0] || ''}.`

            leaderboard.push({
                rank: 0,
                studentId: studentId.toString(),
                displayName,
                score: Math.round(currentAvg * 10) / 10,
                examsTaken: currentAttempts.length,
                trend
            })
        }

        // Sort and assign ranks
        leaderboard.sort((a, b) => b.score - a.score)
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1
        })

        return leaderboard
    }

    /**
     * Get engagement statistics for a teacher
     * Calculates real metrics based on student attempts
     */
    static async getTeacherEngagementStats(teacherId: string): Promise<{
        totalAttempts: number
        completionRate: number
        averageTimeSpent: number
        activeStudentsThisWeek: number
        totalStudents: number
    }> {
        const Class = mongoose.models.Class
        const Attempt = mongoose.models.Attempt

        // Get all classes for this teacher
        const classes = await Class.find({ 
            mainTeacher: new mongoose.Types.ObjectId(teacherId) 
        }).lean()

        const allStudentIds = classes.flatMap((c: any) => 
            (c.students || []).map((s: any) => s.toString())
        )
        const uniqueStudentIds = [...new Set(allStudentIds)]
        const totalStudents = uniqueStudentIds.length

        if (totalStudents === 0) {
            return {
                totalAttempts: 0,
                completionRate: 0,
                averageTimeSpent: 0,
                activeStudentsThisWeek: 0,
                totalStudents: 0
            }
        }

        const objectIds = uniqueStudentIds.map(id => new mongoose.Types.ObjectId(id))

        // Get all attempts for these students
        const allAttempts = await Attempt.find({
            userId: { $in: objectIds }
        }).lean()

        // Calculate total attempts
        const totalAttempts = allAttempts.length

        // Calculate completion rate (completed vs started)
        const completedAttempts = allAttempts.filter((a: any) => 
            a.status === 'COMPLETED' || a.status === 'SUBMITTED'
        ).length
        const startedAttempts = allAttempts.filter((a: any) => 
            a.status === 'STARTED' || a.status === 'IN_PROGRESS'
        ).length
        
        const completionRate = totalAttempts > 0 
            ? Math.round((completedAttempts / totalAttempts) * 100) 
            : 0

        // Calculate average time spent (in minutes)
        const timeSpentValues: number[] = []
        for (const attempt of allAttempts) {
            if (attempt.startedAt && (attempt.submittedAt || attempt.completedAt)) {
                const endTime = attempt.submittedAt || attempt.completedAt
                const durationMinutes = Math.round(
                    (new Date(endTime).getTime() - new Date(attempt.startedAt).getTime()) / (1000 * 60)
                )
                // Only count reasonable durations (1 min to 3 hours)
                if (durationMinutes >= 1 && durationMinutes <= 180) {
                    timeSpentValues.push(durationMinutes)
                }
            }
        }
        
        const averageTimeSpent = timeSpentValues.length > 0
            ? Math.round(timeSpentValues.reduce((a, b) => a + b, 0) / timeSpentValues.length)
            : 0

        // Calculate active students this week (7 days)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const activeStudentIds = new Set<string>()
        for (const attempt of allAttempts) {
            const attemptDate = attempt.submittedAt || attempt.completedAt || attempt.startedAt
            if (attemptDate && new Date(attemptDate) >= oneWeekAgo) {
                activeStudentIds.add(attempt.userId.toString())
            }
        }
        
        const activeStudentsThisWeek = activeStudentIds.size

        return {
            totalAttempts,
            completionRate,
            averageTimeSpent,
            activeStudentsThisWeek,
            totalStudents
        }
    }
}
