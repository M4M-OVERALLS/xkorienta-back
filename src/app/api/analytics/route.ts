/**
 * API Route: /api/analytics
 * Get analytics and comparisons for classes, schools, and cohorts
 */

import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AnalyticsEngine } from "@/lib/services/AnalyticsEngine"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Only teachers, admins, inspectors can access analytics
        const allowedRoles = ['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL', 'RECTOR']
        if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ message: "Access denied" }, { status: 403 })
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const type = searchParams.get("type") // strengths, compare-classes, compare-schools, subject, progression, cohort, correlations
        const studentId = searchParams.get("studentId")
        const classId = searchParams.get("classId")
        const schoolId = searchParams.get("schoolId")
        const subjectId = searchParams.get("subjectId")

        let result: any

        switch (type) {
            case "strengths":
                if (!studentId) {
                    return NextResponse.json({ message: "studentId required" }, { status: 400 })
                }
                result = await AnalyticsEngine.identifyStrengthsAndWeaknesses(studentId)
                break

            case "compare-classes":
                if (!schoolId) {
                    return NextResponse.json({ message: "schoolId required" }, { status: 400 })
                }
                result = await AnalyticsEngine.compareClasses(schoolId, subjectId || undefined)
                break

            case "compare-schools":
                const schoolIds = searchParams.get("schoolIds")?.split(",") || []
                if (schoolIds.length === 0) {
                    return NextResponse.json({ message: "schoolIds required (comma-separated)" }, { status: 400 })
                }
                const region = searchParams.get("region") || undefined
                result = await AnalyticsEngine.compareSchools(schoolIds, { region })
                break

            case "subject":
                if (!classId || !subjectId) {
                    return NextResponse.json({ message: "classId and subjectId required" }, { status: 400 })
                }
                result = await AnalyticsEngine.analyzeSubjectPerformance(classId, subjectId)
                break

            case "progression":
                if (!studentId) {
                    return NextResponse.json({ message: "studentId required" }, { status: 400 })
                }
                const startDate = searchParams.get("startDate")
                    ? new Date(searchParams.get("startDate")!)
                    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: 30 days ago
                const endDate = searchParams.get("endDate")
                    ? new Date(searchParams.get("endDate")!)
                    : new Date()
                result = await AnalyticsEngine.generateProgressionReport(studentId, startDate, endDate)
                break

            case "cohort":
                const cohortStudentIds = searchParams.get("studentIds")?.split(",") || []
                const cohortName = searchParams.get("cohortName") || "Cohorte"
                if (cohortStudentIds.length === 0) {
                    return NextResponse.json({ message: "studentIds required (comma-separated)" }, { status: 400 })
                }
                result = await AnalyticsEngine.analyzeCohort(cohortStudentIds, cohortName)
                break

            case "correlations":
                const correlationStudentIds = searchParams.get("studentIds")?.split(",") || []
                if (correlationStudentIds.length < 5) {
                    return NextResponse.json({
                        message: "At least 5 studentIds required for correlation analysis"
                    }, { status: 400 })
                }
                result = await AnalyticsEngine.findCorrelations(correlationStudentIds)
                break

            case "engagement":
                // Get engagement stats for the current teacher
                const teacherId = session.user.id
                result = await AnalyticsEngine.getTeacherEngagementStats(teacherId)
                break

            default:
                return NextResponse.json({
                    message: "type parameter required. Valid values: strengths, compare-classes, compare-schools, subject, progression, cohort, correlations"
                }, { status: 400 })
        }

        return NextResponse.json({ success: true, data: result })
    } catch (error: any) {
        console.error("[Analytics API Error]", error)
        return NextResponse.json(
            { success: false, message: error.message || "Something went wrong" },
            { status: 500 }
        )
    }
}
