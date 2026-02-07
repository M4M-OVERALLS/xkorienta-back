import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Attempt from "@/models/Attempt";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Option from "@/models/Option";
import Response from "@/models/Response";
import { isPast, addMinutes, isAfter } from "date-fns";

interface RouteParams {
    params: Promise<{ attemptId: string }>
}

/**
 * GET /api/student/attempts/[attemptId]
 * Get detailed attempt data for review
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
        const { attemptId } = await params;

        // Fetch the attempt
        const attemptDoc = await Attempt.findById(attemptId).lean();
        if (!attemptDoc) {
            return NextResponse.json(
                { success: false, message: "Tentative non trouvée" },
                { status: 404 }
            );
        }

        // Verify this attempt belongs to the current user
        if (attemptDoc.userId.toString() !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Accès refusé" },
                { status: 403 }
            );
        }

        // Fetch the exam
        const examDoc = await Exam.findById(attemptDoc.examId).lean();
        if (!examDoc) {
            return NextResponse.json(
                { success: false, message: "Examen non trouvé" },
                { status: 404 }
            );
        }

        // Calculate late exam period
        const now = new Date();
        const lateDuration = (examDoc.config as any)?.lateDuration || 0;
        const delayResultsUntilLateEnd = (examDoc.config as any)?.delayResultsUntilLateEnd ?? false;
        const examEndTime = new Date(examDoc.endTime);
        const lateEndTime = addMinutes(examEndTime, lateDuration);

        // Check access conditions
        const examEnded = isPast(examEndTime);
        const inLatePeriod = examEnded && isAfter(lateEndTime, now) && lateDuration > 0;
        const resultsBlocked = !examEnded || (delayResultsUntilLateEnd && inLatePeriod);

        // Time remaining until results
        const timeUntilResults = inLatePeriod
            ? Math.ceil((lateEndTime.getTime() - now.getTime()) / 1000 / 60)
            : 0;

        // Teachers can always review, students follow late exam rules
        if (session.user.role !== "TEACHER" && resultsBlocked) {
            return NextResponse.json({
                success: false,
                blocked: true,
                inLatePeriod,
                timeUntilResults,
                message: inLatePeriod 
                    ? "Les résultats seront disponibles après la fin de la période retardataires."
                    : "Les résultats seront disponibles après la fin de l'examen."
            }, { status: 403 });
        }

        // Fetch questions and options
        const questionsDoc = await Question.find({ examId: examDoc._id }).lean();
        const questionIds = questionsDoc.map(q => q._id);
        const optionsDoc = await Option.find({ questionId: { $in: questionIds } }).lean();

        // Fetch student responses
        const responsesDoc = await Response.find({ attemptId: attemptDoc._id }).lean();

        const exam = {
            id: examDoc._id.toString(),
            title: examDoc.title,
            description: examDoc.description,
            startTime: examDoc.startTime.toISOString(),
            endTime: examDoc.endTime.toISOString(),
            duration: examDoc.duration,
            closeMode: examDoc.closeMode,
            createdById: examDoc.createdById.toString(),
            createdAt: examDoc.createdAt.toISOString(),
            updatedAt: examDoc.updatedAt.toISOString(),
            questions: questionsDoc.map(q => ({
                id: q._id.toString(),
                examId: q.examId.toString(),
                text: q.text,
                imageUrl: q.imageUrl,
                type: q.type || 'QCM',
                correctAnswer: q.correctAnswer,
                modelAnswer: q.modelAnswer,
                explanation: q.explanation,
                points: q.points,
                options: optionsDoc
                    .filter(o => o.questionId.toString() === q._id.toString())
                    .map(o => ({
                        id: o._id.toString(),
                        questionId: o.questionId.toString(),
                        text: o.text,
                        isCorrect: o.isCorrect,
                    }))
            }))
        };

        const attempt = {
            id: attemptDoc._id.toString(),
            examId: attemptDoc.examId.toString(),
            userId: attemptDoc.userId.toString(),
            startedAt: attemptDoc.startedAt.toISOString(),
            expiresAt: attemptDoc.expiresAt.toISOString(),
            submittedAt: attemptDoc.submittedAt?.toISOString(),
            status: attemptDoc.status,
            score: attemptDoc.score,
            resumeToken: attemptDoc.resumeToken,
            responses: responsesDoc.map(r => ({
                id: r._id.toString(),
                attemptId: r.attemptId.toString(),
                questionId: r.questionId.toString(),
                selectedOptionId: r.selectedOptionId?.toString() || "",
                textResponse: r.textResponse || "",
                isCorrect: r.isCorrect,
            }))
        };

        return NextResponse.json({
            success: true,
            exam,
            attempt
        });

    } catch (error: any) {
        console.error("[Get Attempt Detail] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
