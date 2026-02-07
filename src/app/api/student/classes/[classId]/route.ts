import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ClassService } from "@/lib/services/ClassService";
import Attempt from "@/models/Attempt";
import Question from "@/models/Question";
import { isPast } from "date-fns";

interface RouteParams {
    params: Promise<{ classId: string }>
}

/**
 * GET /api/student/classes/[classId]
 * Get class details with exams for a student
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
        const { classId } = await params;

        // 1. Fetch Class Data
        const classData = await ClassService.getClassById(classId);
        if (!classData) {
            return NextResponse.json(
                { success: false, message: "Classe non trouvée" },
                { status: 404 }
            );
        }

        // Verify student is enrolled
        const isEnrolled = classData.students?.some((s: any) => s._id.toString() === session.user.id);
        if (!isEnrolled) {
            return NextResponse.json(
                { success: false, message: "Vous n'êtes pas inscrit dans cette classe" },
                { status: 403 }
            );
        }

        // 2. Fetch Exams for this class
        const exams = await ClassService.getClassExams(classId);

        // 3. Fetch user attempts for these exams
        const attempts = await Attempt.find({
            userId: session.user.id,
            examId: { $in: exams.map((e: any) => e._id) }
        }).lean();

        // 4. Format Exams for UI
        const examsWithData = await Promise.all(
            exams.map(async (exam: any) => {
                const questionCount = await Question.countDocuments({ examId: exam._id });
                const userAttempt = attempts.find((a: any) => a.examId.toString() === exam._id.toString());

                const isStarted = isPast(new Date(exam.startTime));
                const isEnded = isPast(new Date(exam.endTime));
                const isActive = isStarted && !isEnded;

                let status = "upcoming";
                if (userAttempt?.status === "COMPLETED") status = "completed";
                else if (userAttempt?.status === "STARTED") status = "in_progress";
                else if (isEnded) status = "missed";
                else if (isActive) status = "active";

                return {
                    id: exam._id.toString(),
                    title: exam.title,
                    description: exam.description,
                    startTime: exam.startTime.toISOString(),
                    endTime: exam.endTime.toISOString(),
                    duration: exam.duration,
                    closeMode: exam.closeMode,
                    createdById: exam.createdById?.toString(),
                    attempts: userAttempt ? [{
                        id: userAttempt._id.toString(),
                        status: userAttempt.status,
                        score: userAttempt.score,
                    }] : [],
                    _count: { questions: questionCount },
                    subject: exam.subject,
                    status
                };
            })
        );

        return NextResponse.json({
            success: true,
            class: {
                id: classData._id.toString(),
                name: classData.name,
                academicYear: classData.academicYear,
                school: classData.school,
                level: classData.level,
                mainTeacher: classData.mainTeacher,
                students: classData.students?.length || 0
            },
            exams: examsWithData
        });

    } catch (error: any) {
        console.error("[Get Student Class Detail] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
