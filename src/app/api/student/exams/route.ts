import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * GET /api/student/exams
 * Get all exams available for the current student
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return StudentController.getStudentExams("");
    }

    return StudentController.getStudentExams(session.user.id);
}
