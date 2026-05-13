import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { ExamServiceV2 } from "@/lib/services/ExamServiceV2"
import { requireExamRead } from "@/lib/middleware/requireExamRead"

/**
 * GET /api/exams/v2/[id]
 * Récupère un examen par ID avec toutes ses relations
 * Query param: includeQuestions=true pour inclure les questions
 *
 * SECURITY: Protected by requireExamRead — only creator,
 * same-school admins/inspectors, platform admins, or public-demo access.
 */
export const GET = requireExamRead(
    async (req, { exam }) => {
        try {
            const { searchParams } = new URL(req.url)
            const includeQuestions = searchParams.get('includeQuestions') === 'true'

            const fullExam = await ExamServiceV2.getExamById(
                exam._id.toString(),
                includeQuestions
            )

            return NextResponse.json({
                success: true,
                data: fullExam
            })
        } catch (error) {
            console.error("[ExamV2 API] Error:", error)
            return NextResponse.json(
                { success: false, message: "Internal server error" },
                { status: 500 }
            )
        }
    }
)

/**
 * PUT /api/exams/v2/[id]
 * Met à jour un examen
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        await connectDB()
        const { id } = await params
        const updateData = await req.json()

        const updatedExam = await ExamServiceV2.updateExam(
            id,
            updateData,
            session.user.id
        )

        return NextResponse.json({
            success: true,
            data: updatedExam,
            message: "Exam updated successfully"
        })
    } catch (error: any) {
        console.error("[ExamV2 API] Error:", error)

        if (error.message.includes("not found")) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes("Unauthorized")) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 403 }
            )
        }

        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/exams/v2/[id]
 * Suppression douce (archive) d'un examen
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        await connectDB()
        const { id } = await params

        const result = await ExamServiceV2.deleteExam(id, session.user.id)

        return NextResponse.json({
            success: true,
            message: result.message
        })
    } catch (error: any) {
        console.error("[ExamV2 API] Error:", error)

        if (error.message.includes("not found")) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 404 }
            )
        }

        if (error.message.includes("Unauthorized")) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 403 }
            )
        }

        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
