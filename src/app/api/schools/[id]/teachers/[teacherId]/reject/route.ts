import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolService } from "@/lib/services/SchoolService";
import { NextResponse } from "next/server";

/**
 * POST /api/schools/[id]/teachers/[teacherId]/reject
 * Reject a teacher applicant for a school
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { success: false, message: "Non authentifié" },
                { status: 401 }
            );
        }

        await connectDB();
        const { id: schoolId, teacherId } = await params;

        // Reject the teacher
        const result = await SchoolService.rejectTeacher(schoolId, teacherId);

        return NextResponse.json(
            {
                success: true,
                message: "Professeur rejeté avec succès",
                data: result
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error rejecting teacher:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Erreur lors du rejet du professeur"
            },
            { status: 500 }
        );
    }
}
