import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { AttemptController } from "@/lib/controllers/AttemptController"

/**
 * POST /api/attempts/[id]/submit
 * Soumet une tentative avec les réponses et l'évalue
 * Body: { 
 *   responses: Array<{
 *     questionId: string
 *     selectedOptionId?: string
 *     textAnswer?: string
 *     timeSpent?: number
 *   }>
 * }
 */
export async function POST(
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

        return await AttemptController.submitAttempt(req, id, session.user.id)

    } catch (error: any) {
        console.error("[SubmitAttempt API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
