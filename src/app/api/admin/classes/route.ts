import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { ClassController } from "@/lib/controllers/ClassController"
import { UserRole } from "@/models/enums"

/**
 * GET /api/admin/classes
 * Get classes for school admin's school(s)
 * Supports filter by validationStatus query param
 */
export async function GET(req: NextRequest) {
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
                { success: false, message: "Only school administrators can access this resource" },
                { status: 403 }
            )
        }

        await connectDB()

        return await ClassController.getAdminClasses(req, session.user.id)

    } catch (error: any) {
        console.error("Error fetching admin classes:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
