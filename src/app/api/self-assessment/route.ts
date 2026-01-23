import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StudentController } from "@/lib/controllers/StudentController"

/**
 * POST /api/self-assessment
 * Save a student's self-assessment for a concept
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.saveSelfAssessment(req, "")
    }

    return StudentController.saveSelfAssessment(req, session.user.id)
}

/**
 * GET /api/self-assessment
 * Get all self-assessments for the current student
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return StudentController.getSelfAssessments(req, "")
    }

    return StudentController.getSelfAssessments(req, session.user.id)
}
