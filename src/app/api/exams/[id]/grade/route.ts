import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import * as Sentry from "@sentry/nextjs"

/**
 * GET /api/exams/[id]/grade
 * Retourne toutes les réponses aux questions ouvertes en attente de correction manuelle.
 *
 * PATCH /api/exams/[id]/grade
 * Body: { responseId, manualScore, teacherComment }
 * Enregistre la note et le commentaire d'un correcteur pour une réponse ouverte.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 })
        }

        const { id: examId } = await params
        await connectDB()

        const mongoose = (await import("mongoose")).default
        require("@/models/Exam")
        require("@/models/Attempt")
        require("@/models/Response")
        require("@/models/Question")
        require("@/models/User")

        const Exam = mongoose.model("Exam")
        const Attempt = mongoose.model("Attempt")
        const Response = mongoose.model("Response")
        const Question = mongoose.model("Question")

        // Vérifier que l'exam appartient à l'enseignant
        const exam = await Exam.findById(examId).select("title createdById").lean() as any
        if (!exam) return NextResponse.json({ success: false, error: "Examen non trouvé" }, { status: 404 })
        if (String(exam.createdById) !== session.user.id) {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 })
        }

        // Questions ouvertes de cet examen
        const openQuestions = await Question.find({
            examId,
            type: "OPEN_QUESTION"
        }).select("_id text points openQuestionConfig modelAnswer").lean() as any[]

        if (openQuestions.length === 0) {
            return NextResponse.json({
                success: true,
                data: { exam: { _id: examId, title: exam.title }, questions: [], responses: [] }
            })
        }

        const openQIds = openQuestions.map((q: any) => q._id)

        // Tentatives complétées
        const attempts = await Attempt.find({ examId, status: "COMPLETED" })
            .populate("userId", "name email")
            .select("_id userId submittedAt score percentage")
            .lean() as any[]

        const attemptIds = attempts.map((a: any) => a._id)

        // Réponses aux questions ouvertes
        const responses = await Response.find({
            attemptId: { $in: attemptIds },
            questionId: { $in: openQIds }
        }).lean() as any[]

        // Préparer le résultat groupé par tentative
        const attemptMap = new Map(attempts.map((a: any) => [String(a._id), a]))
        const questionMap = new Map(openQuestions.map((q: any) => [String(q._id), q]))

        const grouped = responses.map((r: any) => ({
            responseId: String(r._id),
            attemptId: String(r.attemptId),
            questionId: String(r.questionId),
            student: attemptMap.get(String(r.attemptId))?.userId ?? null,
            submittedAt: attemptMap.get(String(r.attemptId))?.submittedAt ?? null,
            question: questionMap.get(String(r.questionId)) ?? null,
            textResponse: r.textResponse ?? "",
            gradingStatus: r.gradingStatus ?? "pending",
            manualScore: r.manualScore ?? null,
            teacherComment: r.teacherComment ?? "",
            gradedAt: r.gradedAt ?? null,
        }))

        return NextResponse.json({
            success: true,
            data: {
                exam: { _id: examId, title: exam.title },
                questions: openQuestions,
                responses: grouped,
                pendingCount: grouped.filter(r => r.gradingStatus === "pending").length,
                gradedCount: grouped.filter(r => r.gradingStatus === "graded").length,
            }
        })
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 })
        }

        const { id: examId } = await params
        const body = await req.json()
        const { responseId, manualScore, teacherComment } = body

        if (!responseId || manualScore === undefined) {
            return NextResponse.json({ success: false, error: "responseId et manualScore sont requis" }, { status: 400 })
        }
        if (typeof manualScore !== "number" || manualScore < 0 || manualScore > 100) {
            return NextResponse.json({ success: false, error: "manualScore doit être entre 0 et 100" }, { status: 400 })
        }

        await connectDB()
        const mongoose = (await import("mongoose")).default
        require("@/models/Response")

        const Response = mongoose.model("Response")

        const updated = await Response.findByIdAndUpdate(
            responseId,
            {
                manualScore,
                teacherComment: teacherComment ?? "",
                gradingStatus: "graded",
                gradedBy: session.user.id,
                gradedAt: new Date(),
                isCorrect: manualScore >= 50, // 50% = correct par défaut
                partialScore: manualScore,
            },
            { new: true }
        ).lean()

        if (!updated) {
            return NextResponse.json({ success: false, error: "Réponse non trouvée" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
