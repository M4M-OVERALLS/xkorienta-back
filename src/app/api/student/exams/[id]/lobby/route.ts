import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Attempt from "@/models/Attempt";

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/student/exams/[id]/lobby
 * Get exam details for the lobby page (without questions)
 * Includes question count and student's attempts
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            );
        }

        await connectDB();
        const { id } = await params;

        // Fetch the exam
        const examDoc = await Exam.findById(id).lean();
        if (!examDoc) {
            return NextResponse.json(
                { success: false, message: "Examen non trouvé" },
                { status: 404 }
            );
        }

        // Count questions
        const questionCount = await Question.countDocuments({ examId: id });

        // Fetch student's attempts for this exam
        const attemptsDoc = await Attempt.find({
            examId: id,
            userId: session.user.id
        }).lean();

        const exam = {
            id: examDoc._id.toString(),
            title: examDoc.title,
            description: examDoc.description,
            startTime: examDoc.startTime.toISOString(),
            endTime: examDoc.endTime.toISOString(),
            duration: examDoc.duration,
            closeMode: examDoc.closeMode,
            config: examDoc.config,
            createdById: examDoc.createdById.toString(),
            createdAt: examDoc.createdAt.toISOString(),
            updatedAt: examDoc.updatedAt.toISOString(),
            _count: { questions: questionCount }
        };

        const attempts = attemptsDoc.map(a => ({
            id: a._id.toString(),
            examId: a.examId.toString(),
            userId: a.userId.toString(),
            status: a.status,
            score: a.score,
            startedAt: a.startedAt?.toISOString(),
            submittedAt: a.submittedAt?.toISOString(),
            expiresAt: a.expiresAt.toISOString(),
            resumeToken: a.resumeToken,
        }));

        return NextResponse.json({
            success: true,
            exam,
            attempts
        });

    } catch (error: any) {
        console.error("[Get Exam Lobby] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
