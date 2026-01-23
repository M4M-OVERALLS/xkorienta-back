import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/gamification
 * Get gamification stats for the current student
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getGamificationStats("")
    }

    return StudentController.getGamificationStats(session.user.id)
}
