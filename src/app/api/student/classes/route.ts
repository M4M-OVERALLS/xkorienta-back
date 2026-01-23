import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/classes
 * Get all active classes the student is enrolled in with rankings
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getStudentClasses("")
    }

    return StudentController.getStudentClasses(session.user.id)
}
