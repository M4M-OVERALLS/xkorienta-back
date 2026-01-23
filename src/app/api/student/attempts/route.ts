import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * GET /api/student/attempts
 * Get all completed attempts for the student with exam details
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return StudentController.getStudentAttempts("");
    }

    return StudentController.getStudentAttempts(session.user.id);
}
