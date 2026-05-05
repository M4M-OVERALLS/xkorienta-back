import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ClassService } from "@/lib/services/ClassService";
import Attempt from "@/models/Attempt";
import Question from "@/models/Question";
import Syllabus from "@/models/Syllabus";
import { isPast } from "date-fns";
import mongoose from "mongoose";

interface RouteParams {
    params: Promise<{ classId: string }>
}

/**
 * GET /api/student/classes/[classId]
 * Get class details with exams, students, teachers, syllabuses, and ranking for a student
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

        // 1. Fetch Class Data (populates students, mainTeacher, level, school, field, specialty)
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
        const examIds = exams.map((e: any) => e._id);
        const userAttempts = await Attempt.find({
            userId: session.user.id,
            examId: { $in: examIds }
        }).lean();

        // 4. Format Exams for UI
        const examsWithData = await Promise.all(
            exams.map(async (exam: any) => {
                const questionCount = await Question.countDocuments({ examId: exam._id });
                const userAttempt = userAttempts.find((a: any) => a.examId.toString() === exam._id.toString());

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

        // 5. Format Students list
        const studentsList = (classData.students || []).map((s: any) => ({
            id: s._id.toString(),
            name: s.name,
            email: s.email,
            image: s.image || null,
            isActive: s.isActive !== false,
        }));

        // 6. Fetch teachers (class-level assignment with subjects)
        const Class = mongoose.models.Class || mongoose.model("Class");
        const classWithTeachers = await Class.findById(classId)
            .populate({ path: "teachers.teacher", select: "name email image" })
            .populate({ path: "teachers.subject", select: "name code" })
            .populate({ path: "mainTeacher", select: "name email image" })
            .lean();

        const mainTeacherFormatted = classWithTeachers?.mainTeacher
            ? {
                id: (classWithTeachers.mainTeacher as any)._id?.toString(),
                name: (classWithTeachers.mainTeacher as any).name,
                email: (classWithTeachers.mainTeacher as any).email,
                image: (classWithTeachers.mainTeacher as any).image || null,
                role: "Professeur principal",
                subjects: [],
            }
            : null;

        // Group collaborating teachers by teacher ID
        const teacherMap = new Map<string, { id: string; name: string; email: string; image: string | null; role: string; subjects: { id: string; name: string; code: string }[] }>();
        for (const entry of (classWithTeachers?.teachers || []) as any[]) {
            const t = entry.teacher;
            if (!t?._id) continue;
            const tid = t._id.toString();
            if (!teacherMap.has(tid)) {
                teacherMap.set(tid, {
                    id: tid,
                    name: t.name,
                    email: t.email,
                    image: t.image || null,
                    role: "Collaborateur",
                    subjects: [],
                });
            }
            if (entry.subject?._id) {
                teacherMap.get(tid)!.subjects.push({
                    id: entry.subject._id.toString(),
                    name: entry.subject.name,
                    code: entry.subject.code,
                });
            }
        }

        const teachersList = [
            ...(mainTeacherFormatted ? [mainTeacherFormatted] : []),
            ...Array.from(teacherMap.values()),
        ];

        // 7. Fetch Syllabuses assigned to this class
        const syllabuses = await Syllabus.find({ classes: classId })
            .populate("subject", "name code")
            .populate("teacher", "name")
            .lean();

        const syllabusesList = syllabuses.map((s: any) => ({
            id: s._id.toString(),
            title: s.title,
            description: s.description || null,
            status: s.status,
            subject: s.subject ? { id: s.subject._id?.toString(), name: s.subject.name, code: s.subject.code } : null,
            teacher: s.teacher ? { id: s.teacher._id?.toString(), name: s.teacher.name } : null,
            chaptersCount: s.structure?.chapters?.length || 0,
            version: s.version || 1,
        }));

        // 8. Compute Ranking: aggregate completed attempts per student across all class exams
        const completedAttempts = await Attempt.find({
            examId: { $in: examIds },
            status: "COMPLETED",
        })
            .select("userId examId score")
            .lean();

        // Per-student: average score across all completed exams they participated in
        const studentScoreMap = new Map<string, { total: number; count: number; name: string; image: string | null }>();

        // Pre-build student lookup
        const studentLookup = new Map<string, { name: string; image: string | null }>();
        for (const s of studentsList) {
            studentLookup.set(s.id, { name: s.name, image: s.image });
        }

        for (const attempt of completedAttempts) {
            const uid = attempt.userId?.toString();
            if (!uid || !studentLookup.has(uid)) continue;
            const current = studentScoreMap.get(uid) ?? { total: 0, count: 0, name: studentLookup.get(uid)!.name, image: studentLookup.get(uid)!.image };
            current.total += attempt.score || 0;
            current.count += 1;
            studentScoreMap.set(uid, current);
        }

        // Also include students with 0 completed attempts
        for (const s of studentsList) {
            if (!studentScoreMap.has(s.id)) {
                studentScoreMap.set(s.id, { total: 0, count: 0, name: s.name, image: s.image });
            }
        }

        // Sort descending by average score, assign ranks
        const rankingRaw = Array.from(studentScoreMap.entries())
            .map(([id, data]) => ({
                id,
                name: data.name,
                image: data.image,
                averageScore: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : null,
                examsCompleted: data.count,
            }))
            .sort((a, b) => {
                // Students with no completed exams go to the bottom
                if (a.averageScore === null && b.averageScore === null) return 0;
                if (a.averageScore === null) return 1;
                if (b.averageScore === null) return -1;
                return b.averageScore - a.averageScore;
            });

        const rankingList = rankingRaw.map((entry, index) => ({
            rank: index + 1,
            isCurrentUser: entry.id === session.user.id,
            ...entry,
        }));

        return NextResponse.json({
            success: true,
            class: {
                id: classData._id.toString(),
                name: classData.name,
                academicYear: classData.academicYear,
                school: classData.school,
                level: classData.level,
                mainTeacher: classData.mainTeacher,
                studentsCount: studentsList.length,
            },
            exams: examsWithData,
            students: studentsList,
            teachers: teachersList,
            syllabuses: syllabusesList,
            ranking: rankingList,
        });

    } catch (error: any) {
        console.error("[Get Student Class Detail] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
