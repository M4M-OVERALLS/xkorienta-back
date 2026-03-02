import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolService } from "@/lib/services/SchoolService";
import { NextResponse } from "next/server";

/**
 * POST /api/schools/[id]/teachers/[teacherId]/approve
 * Approve a teacher applicant for a school
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

        // Approve the teacher
        const result = await SchoolService.approveTeacher(schoolId, teacherId);

        return NextResponse.json(
            {
                success: true,
                message: "Professeur approuvé avec succès",
                data: result
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error approving teacher:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Erreur lors de l'approbation du professeur"
            },
            { status: 500 }
        );
    }
}
