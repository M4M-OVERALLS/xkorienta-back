import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import Question from "@/models/Question"
import Option from "@/models/Option"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { UserRole, CloseMode } from "@/models/enums"

const examSchema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    duration: z.coerce.number().min(1),
    closeMode: z.enum(["STRICT", "PERMISSIVE"]).default("STRICT"),
    questions: z.array(
        z.object({
            text: z.string().min(1),
            imageUrl: z.string().optional().or(z.literal("")),
            points: z.coerce.number().min(1),
            options: z.array(
                z.object({
                    text: z.string().min(1),
                    isCorrect: z.boolean(),
                })
            ),
        })
    ),
})

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        await connectDB()

        let query = {}

        // Role-based filtering
        if (session.user.role === UserRole.TEACHER) {
            query = { createdById: session.user.id }
        } else if (session.user.role === UserRole.STUDENT) {
            // Students should generally use /api/student/exams
            // But if they access this, generic list or forbidden?
            // Let's return Forbidden to encourage correct usage, or empty implementation
            return NextResponse.json(
                { success: false, message: "Students should use /api/student/exams" },
                { status: 403 }
            )
        }

        const exams = await Exam.find(query).sort({ createdAt: -1 }).lean()

        const formattedExams = exams.map((exam: any) => ({
            ...exam,
            id: exam._id.toString(),
        }))

        return NextResponse.json({ success: true, data: formattedExams })

    } catch (error: any) {
        console.error("Get Exams Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "TEACHER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        await connectDB()

        const body = await req.json()
        const data = examSchema.parse(body)

        // Create exam
        const exam = await Exam.create({
            title: data.title,
            description: data.description,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            duration: data.duration,
            closeMode: data.closeMode as CloseMode,
            createdById: session.user.id,
        })

        // Create questions with options
        for (const questionData of data.questions) {
            const question = await Question.create({
                examId: exam._id,
                text: questionData.text,
                imageUrl: questionData.imageUrl || undefined,
                points: questionData.points,
            })

            // Create options for this question
            await Option.insertMany(
                questionData.options.map((o) => ({
                    questionId: question._id,
                    text: o.text,
                    isCorrect: o.isCorrect,
                }))
            )
        }

        return NextResponse.json({
            message: "Exam created",
            exam: {
                id: exam._id.toString(),
                title: exam.title,
                description: exam.description,
                startTime: exam.startTime.toISOString(),
                endTime: exam.endTime.toISOString(),
                duration: exam.duration,
                closeMode: exam.closeMode,
                createdById: exam.createdById.toString(),
            }
        }, { status: 201 })
    } catch (error: any) {
        console.error(error)
        if (error.name === 'ZodError') {
            return NextResponse.json(
                { message: "Invalid input data" },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { message: error.message || "Something went wrong" },
            { status: 500 }
        )
    }
}
