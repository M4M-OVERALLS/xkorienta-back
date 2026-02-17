import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";

/**
 * GET /api/schools/[id]/teachers
 * Get all teachers for a school
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return SchoolController.getSchoolTeachers("");
    }

    await connectDB();
    const { id } = await params;
    return SchoolController.getSchoolTeachers(id);
}
