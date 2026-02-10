import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/specialties
 * Liste des specialites pour l'apprenant
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId") || undefined
    const effectiveStudentId = studentId || session?.user?.id || undefined

    if (!effectiveStudentId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        )
    }

    await connectDB()
    return StudentController.getStudentSpecialties(effectiveStudentId)
}
