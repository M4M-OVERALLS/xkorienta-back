import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { AttemptController } from "@/lib/controllers/AttemptController"

/**
 * POST /api/attempts/[id]/resume
 * Reprend une tentative avec le token de reprise
 * Body: { resumeToken: string }
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

        return await AttemptController.resumeAttempt(req, id, session.user.id)

    } catch (error: any) {
        console.error("[ResumeAttempt API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
