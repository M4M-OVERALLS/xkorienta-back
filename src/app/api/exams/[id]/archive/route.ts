import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { UserRole } from "@/models/enums"
import { ExamWorkflowController } from "@/lib/controllers/ExamWorkflowController"

/**
 * POST /api/exams/[id]/archive
 * Archive un examen publié
 * PUBLISHED → ARCHIVED
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        )
    }

    await connectDB()
    const { id } = await params

    return ExamWorkflowController.archiveExam(
        id,
        session.user.id,
        session.user.role as UserRole
    )
}
