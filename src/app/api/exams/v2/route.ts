import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { ExamServiceV2 } from "@/lib/services/ExamServiceV2"
import { ExamStatus, EvaluationType, DifficultyLevel } from "@/models/enums"
import { EventPublisher } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"
import mongoose from "mongoose"

/**
 * GET /api/exams/v2
 * Liste les examens avec filtres avancés
 * Query params: status, level, subject, field, learningUnit, competency, evaluationType, difficultyLevel, limit, skip
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const filters: any = {
            createdBy: session.user.id // Filter by current user
        }

        if (searchParams.get('status')) {
            filters.status = searchParams.get('status') as ExamStatus
        }
        if (searchParams.get('level')) {
            filters.level = searchParams.get('level')
        }
        if (searchParams.get('subject')) {
            filters.subject = searchParams.get('subject')
        }
        if (searchParams.get('field')) {
            filters.field = searchParams.get('field')
        }
        if (searchParams.get('learningUnit')) {
            filters.learningUnit = searchParams.get('learningUnit')
        }
        if (searchParams.get('competency')) {
            filters.competency = searchParams.get('competency')
        }
        if (searchParams.get('evaluationType')) {
            filters.evaluationType = searchParams.get('evaluationType') as EvaluationType
        }
        if (searchParams.get('difficultyLevel')) {
            filters.difficultyLevel = searchParams.get('difficultyLevel') as DifficultyLevel
        }
        if (searchParams.get('isPublished')) {
            filters.isPublished = searchParams.get('isPublished') === 'true'
        }
        if (searchParams.get('schoolId')) {
            filters.schoolId = searchParams.get('schoolId')!
        }
        if (searchParams.get('limit')) {
            filters.limit = parseInt(searchParams.get('limit')!)
        }
        if (searchParams.get('skip')) {
            filters.skip = parseInt(searchParams.get('skip')!)
        }

        const result = await ExamServiceV2.getExams(filters)

        return NextResponse.json({
            success: true,
            data: result.exams,
            pagination: {
                total: result.total,
                limit: result.limit,
                skip: result.skip,
                hasMore: result.skip + result.limit < result.total
            }
        })
    } catch (error) {
        console.error("[ExamsV2 API] Error:", error)
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/exams/v2
 * Crée un nouvel examen avec tous les champs V2
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        // TODO: Vérifier que l'utilisateur a le droit de créer des examens (TEACHER, etc.)

        await connectDB()
        const examData = await req.json()

        const exam = await ExamServiceV2.createExam(examData, session.user.id)

        // Publish Event
        const publisher = EventPublisher.getInstance()
        await publisher.publish({
            type: EventType.EXAM_CREATED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(session.user.id),
            data: {
                examId: exam._id,
                teacherId: session.user.id,
                title: exam.title || "Nouvel Examen"
            }
        })

        return NextResponse.json({
            success: true,
            data: exam,
            message: "Exam created successfully"
        }, { status: 201 })
    } catch (error: any) {
        console.error("[ExamsV2 API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
