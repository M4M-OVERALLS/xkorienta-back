import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Exam, { ExamConfig } from "@/models/Exam";
import Question, { IQuestion } from "@/models/Question";
import Option from "@/models/Option";
import Attempt, { AttemptStatus } from "@/models/Attempt";
import Response, { IResponse } from "@/models/Response";
import { addMinutes, isAfter, isPast } from "date-fns";

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/student/exams/[id]/review
 * Get exam review data for a student (questions, options, and their responses)
 * Only accessible after exam completion and when review is allowed
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

        // Fetch student's completed attempt
        const attemptDoc = await Attempt.findOne({
            examId: id,
            userId: session.user.id,
            status: AttemptStatus.COMPLETED,
        }).lean();

        if (!attemptDoc) {
            return NextResponse.json(
                { success: false, message: "Aucune tentative complétée pour cet examen" },
                { status: 404 }
            );
        }

        // Check if results are blocked (late exam period)
        const now = new Date();
        const config = examDoc.config as ExamConfig;
        const lateDuration = config?.lateDuration || 0;
        const delayResultsUntilLateEnd = config?.delayResultsUntilLateEnd ?? false;
        const examEndTime = new Date(examDoc.endTime);
        const lateEndTime = addMinutes(examEndTime, lateDuration);

        const examEnded = isPast(examEndTime);
        const inLatePeriod = examEnded && isAfter(lateEndTime, now) && lateDuration > 0;
        const resultsBlocked = !examEnded || (delayResultsUntilLateEnd && inLatePeriod);

        if (session.user.role !== "TEACHER" && resultsBlocked) {
            const timeUntilResults = inLatePeriod
                ? Math.ceil((lateEndTime.getTime() - now.getTime()) / 1000 / 60)
                : 0;
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

        // Fetch questions and their options
        const questionsDoc = await Question.find({ examId: id }).lean();
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
            config: examDoc.config,
            questions: questionsDoc.map((q: IQuestion) => ({
                id: q._id.toString(),
                examId: q.examId.toString(),
                text: q.text,
                imageUrl: q.imageUrl,
                type: q.type || "QCM",
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
            userId: attemptDoc.userId?.toString() || "",
            startedAt: attemptDoc.startedAt.toISOString(),
            expiresAt: attemptDoc.expiresAt.toISOString(),
            submittedAt: attemptDoc.submittedAt?.toISOString(),
            status: attemptDoc.status,
            score: attemptDoc.score,
            responses: responsesDoc.map((r: IResponse) => ({
                id: r._id.toString(),
                attemptId: r.attemptId.toString(),
                questionId: r.questionId.toString(),
                selectedOptionId: r.selectedOptionId?.toString() || "",
                textResponse: r.textResponse || "",
                isCorrect: r.isCorrect,
            }))
        };

        return NextResponse.json({ success: true, exam, attempt });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur";
        console.error("[Get Exam Review] Error:", error);
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
