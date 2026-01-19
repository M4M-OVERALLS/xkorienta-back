import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { AttemptController } from "@/lib/controllers/AttemptController"

/**
 * POST /api/attempts/[id]/anti-cheat-event
 * Enregistre un événement anti-triche
 * Body: { 
 *   type: 'tab_switch' | 'copy_paste' | 'right_click' | 'screenshot' | 'fullscreen_exit'
 *   data?: any
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

        return await AttemptController.recordAntiCheatEvent(req, id, session.user.id)

    } catch (error: any) {
        console.error("[AntiCheatEvent API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
