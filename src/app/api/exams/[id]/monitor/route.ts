import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import Question from "@/models/Question"
import Attempt from "@/models/Attempt"
import LateCode from "@/models/LateCode"
import User from "@/models/User" // Ensure User model is referenced if needed for population

/**
 * GET /api/exams/[id]/monitor
 * Get consolidated data for exam monitoring view
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await connectDB()
        const { id } = await params

        const examDoc = await Exam.findById(id).lean()

        if (!examDoc) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Check permissions (Teacher only, and owner)
        if (session.user.role !== "TEACHER" && session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        if (session.user.role === "TEACHER" && examDoc.createdById.toString() !== session.user.id) {
            return NextResponse.json({ error: "Forbidden access to this exam" }, { status: 403 })
        }

        // Fetch related data
        const questions = await Question.find({ examId: id }).lean()

        // Fetch attempts with user population
        const attemptsDoc = await Attempt.find({ examId: id })
            .sort({ startedAt: -1 })
            .populate('userId', 'name email role image')
            .lean()

        const lateCodes = await LateCode.find({ examId: id }).lean()

        // Format attempts
        const attempts = attemptsDoc.map((a: any) => ({
            id: a._id.toString(),
            examId: a.examId.toString(),
            userId: a.userId?._id?.toString(),
            startedAt: a.startedAt?.toISOString(),
            expiresAt: a.expiresAt?.toISOString(),
            submittedAt: a.submittedAt?.toISOString(),
            status: a.status,
            score: a.score,
            percentage: a.percentage,
            tabSwitchCount: a.tabSwitchCount,
            user: a.userId ? {
                id: a.userId._id.toString(),
                name: a.userId.name,
                email: a.userId.email,
                role: a.userId.role,
                image: a.userId.image
            } : null
        }))

        const examData = {
            id: examDoc._id.toString(),
            title: examDoc.title,
            description: examDoc.description,
            startTime: examDoc.startTime?.toISOString(),
            endTime: examDoc.endTime?.toISOString(),
            duration: examDoc.duration,
            closeMode: examDoc.closeMode,
            status: examDoc.status,
            createdById: examDoc.createdById.toString(),
            createdAt: examDoc.createdAt?.toISOString(),
            updatedAt: examDoc.updatedAt?.toISOString(),
            questions: questions.map(q => ({
                id: q._id.toString(),
                examId: q.examId.toString(),
                text: q.text,
                imageUrl: q.imageUrl,
                points: q.points,
            })),
            attempts,
            lateCodes: lateCodes.map(lc => ({
                id: lc._id.toString(),
                code: lc.code,
                examId: lc.examId.toString(),
                usagesRemaining: lc.usagesRemaining,
                expiresAt: lc.expiresAt?.toISOString(),
                assignedUserId: lc.assignedUserId?.toString(),
            }))
        }

        return NextResponse.json({
            success: true,
            data: examData
        })

    } catch (error: any) {
        console.error("[Exam Monitor API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
