import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/syllabus/[id]/stats
 * Agrège les performances de tous les examens liés à un syllabus.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        // Load models
        const mongoose = (await import("mongoose")).default;
        require("@/models/Syllabus");
        require("@/models/Exam");
        require("@/models/Subject");

        const Syllabus = mongoose.model("Syllabus");
        const Exam = mongoose.model("Exam");

        // Verify syllabus exists and belongs to teacher
        const syllabus = await Syllabus.findById(id)
            .populate("subject", "name code")
            .lean() as any;

        if (!syllabus) {
            return NextResponse.json({ success: false, error: "Syllabus non trouvé" }, { status: 404 });
        }

        // All exams linked to this syllabus
        const exams = await Exam.find({ syllabus: id })
            .select("title status stats evaluationType difficultyLevel chapterIds duration createdAt startTime endTime")
            .lean() as any[];

        // ── Global aggregations ──────────────────────────────────────────────
        const totalAttempts = exams.reduce((s, e) => s + (e.stats?.totalAttempts ?? 0), 0);
        const totalCompletions = exams.reduce((s, e) => s + (e.stats?.totalCompletions ?? 0), 0);

        const examsWithData = exams.filter(e => (e.stats?.totalAttempts ?? 0) > 0);
        const averageScore = examsWithData.length > 0
            ? Math.round(examsWithData.reduce((s, e) => s + (e.stats?.averageScore ?? 0), 0) / examsWithData.length)
            : 0;
        const passRate = examsWithData.length > 0
            ? Math.round(examsWithData.reduce((s, e) => s + (e.stats?.passRate ?? 0), 0) / examsWithData.length)
            : 0;

        // ── Per-chapter stats ────────────────────────────────────────────────
        const chapters: any[] = syllabus.structure?.chapters ?? [];
        const chapterStats = chapters.map((ch: any) => {
            const linked = exams.filter(e =>
                Array.isArray(e.chapterIds) && e.chapterIds.includes(ch.title)
            );
            const linkedWithData = linked.filter(e => (e.stats?.totalAttempts ?? 0) > 0);
            return {
                title: ch.title,
                examCount: linked.length,
                totalAttempts: linked.reduce((s, e) => s + (e.stats?.totalAttempts ?? 0), 0),
                averageScore: linkedWithData.length > 0
                    ? Math.round(linkedWithData.reduce((s, e) => s + (e.stats?.averageScore ?? 0), 0) / linkedWithData.length)
                    : 0,
                passRate: linkedWithData.length > 0
                    ? Math.round(linkedWithData.reduce((s, e) => s + (e.stats?.passRate ?? 0), 0) / linkedWithData.length)
                    : 0,
            };
        });

        // ── Status breakdown ─────────────────────────────────────────────────
        const statusCounts = exams.reduce((acc: Record<string, number>, e) => {
            acc[e.status] = (acc[e.status] ?? 0) + 1;
            return acc;
        }, {});

        return NextResponse.json({
            success: true,
            data: {
                syllabusId: id,
                syllabusTitle: syllabus.title,
                subjectName: syllabus.subject?.name ?? "",
                totalExams: exams.length,
                publishedExams: statusCounts["PUBLISHED"] ?? 0,
                statusCounts,
                globalStats: {
                    totalAttempts,
                    totalCompletions,
                    averageScore,
                    passRate,
                    completionRate: totalAttempts > 0
                        ? Math.round((totalCompletions / totalAttempts) * 100)
                        : 0,
                },
                exams: exams.map(e => ({
                    _id: String(e._id),
                    title: e.title,
                    status: e.status,
                    chapterIds: e.chapterIds ?? [],
                    evaluationType: e.evaluationType,
                    difficultyLevel: e.difficultyLevel,
                    duration: e.duration,
                    createdAt: e.createdAt,
                    stats: {
                        totalAttempts: e.stats?.totalAttempts ?? 0,
                        totalCompletions: e.stats?.totalCompletions ?? 0,
                        averageScore: e.stats?.averageScore ?? 0,
                        passRate: e.stats?.passRate ?? 0,
                    },
                })),
                chapterStats,
            },
        });
    } catch (error: any) {
        Sentry.captureException(error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
