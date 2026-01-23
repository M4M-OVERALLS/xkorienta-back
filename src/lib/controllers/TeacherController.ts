import { NextResponse } from "next/server";
import { TeacherService } from "@/lib/services/TeacherService";

export class TeacherController {
    /**
     * GET /api/teachers/students
     * Get all students from teacher's classes (for messaging)
     */
    static async getTeacherStudents(req: Request, teacherId: string) {
        try {
            const { searchParams } = new URL(req.url);
            const search = searchParams.get('search') || undefined;
            const classId = searchParams.get('classId') || undefined;

            const result = await TeacherService.getTeacherStudents(teacherId, search, classId);

            return NextResponse.json({
                success: true,
                data: result
            });

        } catch (error: any) {
            console.error("[Teacher Controller] Get Teacher Students Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Erreur serveur" },
                { status: 500 }
            );
        }
    }
}
