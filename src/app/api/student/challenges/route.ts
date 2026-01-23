import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/challenges
 * Get all available and participated challenges for the student
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getStudentChallenges("")
    }

    return StudentController.getStudentChallenges(session.user.id)
}
