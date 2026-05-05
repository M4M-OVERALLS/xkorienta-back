import { authOptions } from "@/lib/auth";
import QuestionBank from "@/models/Question";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/questions
 *
 * Récupérer la liste des questions avec filtres optionnels
 *
 * Query params:
 * - subject: ID de la matière
 * - syllabus: ID du syllabus
 * - learningUnits: IDs des unités d'apprentissage (comma-separated)
 * - concepts: IDs des concepts (comma-separated)
 * - difficulty: Niveau de difficulté
 * - type: Type de question (QCM, TRUE_FALSE, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const subject = searchParams.get("subject");
    const syllabus = searchParams.get("syllabus");
    const learningUnits = searchParams.get("learningUnits");
    const concepts = searchParams.get("concepts");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type");

    // Build query
    const query: any = {};

    if (subject) query.subject = subject;
    if (syllabus) query.syllabus = syllabus;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;

    if (learningUnits) {
      const unitIds = learningUnits.split(",");
      query.learningUnit = { $in: unitIds };
    }

    if (concepts) {
      const conceptIds = concepts.split(",");
      query.concepts = { $in: conceptIds };
    }

    const questions = await QuestionBank.find(query)
      .populate("subject", "name")
      .populate("syllabus", "title")
      .populate("learningUnit", "title")
      .populate("concepts", "title")
      .sort({ createdAt: -1 })
      .limit(100); // Limite à 100 questions pour la performance

    return NextResponse.json({
      success: true,
      data: questions,
      count: questions.length,
    });
  } catch (error: any) {
    console.error("[API] Error fetching questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de la récupération des questions",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/questions
 *
 * Créer une nouvelle question
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

    // Validation
    if (!body.text || !body.type) {
      return NextResponse.json(
        {
          success: false,
          error: "Le texte et le type de question sont requis",
        },
        { status: 400 },
      );
    }

    // Créer la question
    const question = await QuestionBank.create({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: question,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[API] Error creating question:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de la création de la question",
      },
      { status: 500 },
    );
  }
}
