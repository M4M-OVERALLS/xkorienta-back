import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * GET /api/student/subjects
 * Get all subjects for the current student with their progress
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return StudentController.getStudentSubjects(session.user.id);
}
