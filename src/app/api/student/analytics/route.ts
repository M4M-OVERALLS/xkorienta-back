import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/analytics
 * Get comprehensive analytics for the current student
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getStudentAnalytics("")
    }

    return StudentController.getStudentAnalytics(session.user.id)
}
