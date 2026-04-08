import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { ClassService } from "@/lib/services/ClassService"
import { ClassTeacherService } from "@/lib/services/ClassTeacherService"
import { UserRole } from "@/models/enums"

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        await connectDB()

        // Check ownership
        const classData = await ClassService.getClassById(id)
        if (!classData) {
            return NextResponse.json({ success: false, message: "Class not found" }, { status: 404 })
        }

        if (session.user.role === UserRole.TEACHER) {
            const allowed = await ClassTeacherService.isTeacherInClass(id, session.user.id)
            if (!allowed) {
                return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 })
            }
        }

        const exams = await ClassService.getClassExams(id)

        return NextResponse.json({ success: true, data: exams })

    } catch (error: any) {
        console.error("Get Class Exams Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
