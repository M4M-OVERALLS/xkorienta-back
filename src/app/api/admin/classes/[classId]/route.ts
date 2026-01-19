import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { ClassController } from "@/lib/controllers/ClassController"
import { UserRole } from "@/models/enums"

interface RouteParams {
    params: Promise<{ classId: string }>
}

/**
 * PATCH /api/admin/classes/[classId]
 * Validate or reject a class
 * Body: { action: 'VALIDATE' | 'REJECT', reason?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        // Verify user is a school admin
        if (session.user.role !== UserRole.SCHOOL_ADMIN) {
            return NextResponse.json(
                { success: false, message: "Only school administrators can validate classes" },
                { status: 403 }
            )
        }

        await connectDB()

        const { classId } = await params

        return await ClassController.validateOrRejectClass(req, classId, session.user.id)

    } catch (error: any) {
        console.error("Error validating class:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
