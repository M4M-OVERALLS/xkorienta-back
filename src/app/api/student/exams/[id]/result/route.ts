import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Attempt from "@/models/Attempt";
import Response from "@/models/Response";
import { addMinutes, isAfter, isPast } from "date-fns";

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/student/exams/[id]/result
 * Get exam result for a student
 * Includes score, responses, and late exam delay handling
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

        // Fetch questions for max score calculation
        const questionsDoc = await Question.find({ examId: id }).lean();
        const maxScore = questionsDoc.reduce((acc: number, q: any) => acc + (q.points || 1), 0);

        // Fetch student's attempt
        const attemptDoc = await Attempt.findOne({
            examId: id,
            userId: session.user.id,
        }).lean();

        if (!attemptDoc) {
            return NextResponse.json(
                { success: false, message: "Tentative non trouvée" },
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
        };

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
            questions: questionsDoc.map(q => ({
                id: q._id.toString(),
                text: q.text,
                points: q.points,
            }))
        };

        return NextResponse.json({
            success: true,
            exam,
            attempt,
            maxScore,
            resultsBlocked,
            inLatePeriod,
            timeUntilResults,
            percentage: attempt.score ? Math.round((attempt.score / maxScore) * 100) : 0
        });

    } catch (error: any) {
        console.error("[Get Exam Result] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
