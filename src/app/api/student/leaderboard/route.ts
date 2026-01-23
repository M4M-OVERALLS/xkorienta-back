import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * GET /api/student/leaderboard
 * Get leaderboard based on type (CLASS, SCHOOL_LEVEL, NATIONAL_LEVEL)
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getLeaderboard(req, "")
    }

    return StudentController.getLeaderboard(req, session.user.id)
}
