import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { AssistanceController } from "@/lib/controllers/AssistanceController"

/**
 * POST /api/assistance
 * Create a new assistance request
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

        await connectDB()

        return await AssistanceController.createRequest(req, session.user.id)

    } catch (error: any) {
        console.error("[Assistance API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * GET /api/assistance
 * Get all assistance requests for the current student
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        await connectDB()

        // Create a dummy request object since the controller expects one
        // and we don't have request params for GET in this simple case
        const req = new Request("http://localhost/api/assistance");

        return await AssistanceController.getStudentRequests(req, session.user.id)

    } catch (error: any) {
        console.error("[Assistance API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
