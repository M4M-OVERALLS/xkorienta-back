import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Option from "@/models/Option";
import Attempt from "@/models/Attempt";
import Response from "@/models/Response";
import Concept from "@/models/Concept";
import { HuggingFaceService, type ReformulationIntensity } from "@/lib/services/HuggingFaceService";

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/student/exams/[id]/take
 * Get exam with questions for taking the exam
 * Includes AI reformulation if enabled
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

        // Fetch questions and options
        const questionsDoc = await Question.find({ examId: id }).lean();
        const questionIds = questionsDoc.map(q => q._id);
        const optionsDoc = await Option.find({ questionId: { $in: questionIds } })
            .select('-isCorrect')
            .lean();

        // Build base questions array
        let examQuestions = questionsDoc.map(q => ({
            id: q._id.toString(),
            examId: q.examId.toString(),
            text: q.text,
            type: q.type || 'QCM',
            imageUrl: q.imageUrl,
            points: q.points,
            correctAnswer: q.correctAnswer,
            modelAnswer: q.modelAnswer,
            openQuestionConfig: q.openQuestionConfig,
            options: optionsDoc
                .filter(o => o.questionId.toString() === q._id.toString())
                .map(o => ({
                    id: o._id.toString(),
                    questionId: o.questionId.toString(),
                    text: o.text,
                }))
        }));

        // Check if AI reformulation is enabled
        const aiReformulation = examDoc.config?.antiCheat?.aiReformulation;
        const reformulationIntensity = (examDoc.config?.antiCheat?.reformulationIntensity || 'MODERATE') as ReformulationIntensity;

        if (aiReformulation && session.user.id) {
            // Apply AI reformulation to questions and options
            try {
                const reformulatedQuestions = await Promise.all(
                    examQuestions.map(async (q, qIndex) => {
                        const seed = `${session.user.id}-${id}-q${qIndex}`;

                        // Reformulate question text
                        const reformulatedText = await HuggingFaceService.reformulateText(
                            q.text,
                            { intensity: reformulationIntensity, language: 'fr' },
                            seed
                        );

                        // Reformulate options
                        const reformulatedOptions = await Promise.all(
                            q.options.map(async (opt, optIndex) => ({
                                ...opt,
                                text: await HuggingFaceService.reformulateText(
                                    opt.text,
                                    { intensity: reformulationIntensity, language: 'fr' },
                                    `${seed}-opt${optIndex}`
                                )
                            }))
                        );

                        return {
                            ...q,
                            text: reformulatedText,
                            options: reformulatedOptions
                        };
                    })
                );
                examQuestions = reformulatedQuestions;
            } catch (error) {
                console.error('[AI Reformulation] Error:', error);
                // Fall back to original questions if reformulation fails
            }
        }

        // Fetch linked concepts if self-assessment is enabled
        let linkedConcepts: any[] = [];
        if (examDoc.config?.enableSelfAssessment && examDoc.linkedConcepts && examDoc.linkedConcepts.length > 0) {
            const conceptsDoc = await Concept.find({
                _id: { $in: examDoc.linkedConcepts }
            }).select('_id title description').lean();

            linkedConcepts = conceptsDoc.map(c => ({
                id: c._id.toString(),
                title: c.title,
                description: c.description
            }));
        }

        const exam = {
            id: examDoc._id.toString(),
            title: examDoc.title,
            description: examDoc.description,
            startTime: examDoc.startTime.toISOString(),
            endTime: examDoc.endTime.toISOString(),
            duration: examDoc.duration,
            closeMode: examDoc.closeMode,
            config: examDoc.config,
            pedagogicalObjective: examDoc.pedagogicalObjective,
            syllabusId: examDoc.syllabus?.toString(),
            linkedConcepts,
            createdById: examDoc.createdById.toString(),
            createdAt: examDoc.createdAt.toISOString(),
            updatedAt: examDoc.updatedAt.toISOString(),
            questions: examQuestions
        };

        // Fetch student's current attempt
        const attemptDoc = await Attempt.findOne({
            examId: id,
            userId: session.user.id,
        }).lean();

        let attempt = null;
        if (attemptDoc) {
            const responsesDoc = await Response.find({ attemptId: attemptDoc._id }).lean();
            attempt = {
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
                    isCorrect: r.isCorrect,
                }))
            };
        }

        return NextResponse.json({
            success: true,
            exam,
            attempt
        });

    } catch (error: any) {
        console.error("[Get Exam Take] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
