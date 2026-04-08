import { authOptions } from "@/lib/auth";
import QuestionBank from "@/models/Question";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/questions/generate
 *
 * Générer automatiquement une sélection de questions basée sur des critères
 *
 * Body:
 * {
 *   subjectId: string,
 *   count: number,
 *   difficulty: string,
 *   syllabusId?: string,
 *   learningUnitIds?: string[],
 *   conceptIds?: string[],
 *   chapterWeights?: Array<{ learningUnit: string, weight: number }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      subjectId,
      count,
      difficulty,
      syllabusId,
      learningUnitIds,
      conceptIds,
      chapterWeights,
    } = body;

    // Validation
    if (!subjectId || !count) {
      return NextResponse.json(
        {
          success: false,
          error: "subjectId et count sont requis",
        },
        { status: 400 },
      );
    }

    if (count < 1 || count > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "Le nombre de questions doit être entre 1 et 200",
        },
        { status: 400 },
      );
    }

    // Si des poids par chapitre sont fournis
    if (chapterWeights && chapterWeights.length > 0) {
      const selectedQuestionBanks: any[] = [];

      for (const weight of chapterWeights) {
        const questionCount = Math.round((weight.weight / 100) * count);

        if (questionCount > 0) {
          const query: any = {
            subject: subjectId,
            learningUnit: weight.learningUnit,
          };

          if (difficulty) query.difficulty = difficulty;
          if (syllabusId) query.syllabus = syllabusId;
          if (conceptIds && conceptIds.length > 0) {
            query.concepts = { $in: conceptIds };
          }

          const questions = await QuestionBank.find(query)
            .populate("subject", "name")
            .populate("learningUnit", "title")
            .limit(questionCount)
            .lean();

          selectedQuestionBanks.push(...questions);
        }
      }

      // Si pas assez de questions, compléter
      if (selectedQuestionBanks.length < count) {
        const remaining = count - selectedQuestionBanks.length;
        const excludeIds = selectedQuestionBanks.map((q) => q._id);

        const query: any = {
          subject: subjectId,
          _id: { $nin: excludeIds },
        };

        if (difficulty) query.difficulty = difficulty;
        if (syllabusId) query.syllabus = syllabusId;
        if (learningUnitIds && learningUnitIds.length > 0) {
          query.learningUnit = { $in: learningUnitIds };
        }

        const extraQuestionBanks = await QuestionBank.find(query)
          .populate("subject", "name")
          .populate("learningUnit", "title")
          .limit(remaining)
          .lean();

        selectedQuestionBanks.push(...extraQuestionBanks);
      }

      return NextResponse.json({
        success: true,
        data: selectedQuestionBanks,
        count: selectedQuestionBanks.length,
      });
    }

    // Sélection simple sans poids
    const query: any = { subject: subjectId };

    if (difficulty) query.difficulty = difficulty;
    if (syllabusId) query.syllabus = syllabusId;

    if (learningUnitIds && learningUnitIds.length > 0) {
      query.learningUnit = { $in: learningUnitIds };
    }

    if (conceptIds && conceptIds.length > 0) {
      query.concepts = { $in: conceptIds };
    }

    const questions = await QuestionBank.find(query)
      .populate("subject", "name")
      .populate("syllabus", "title")
      .populate("learningUnit", "title")
      .populate("concepts", "title")
      .limit(count)
      .lean();

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucune question trouvée avec ces critères. Veuillez élargir les filtres ou créer vos propres questions.",
        },
        { status: 404 },
      );
    }

    if (questions.length < count) {
      console.warn(
        `[API] Only ${questions.length} questions found out of ${count} requested`,
      );
    }

    return NextResponse.json({
      success: true,
      data: questions,
      count: questions.length,
      requested: count,
    });
  } catch (error: any) {
    console.error("[API] Error generating questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de la génération des questions",
      },
      { status: 500 },
    );
  }
}
