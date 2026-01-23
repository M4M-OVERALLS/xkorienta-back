import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { TeacherController } from "@/lib/controllers/TeacherController";

/**
 * GET /api/teachers/students
 * Get all students from teacher's classes (for messaging)
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Non autorisé" },
            { status: 401 }
        );
    }

    await connectDB();
    return TeacherController.getTeacherStudents(req, session.user.id);
}
