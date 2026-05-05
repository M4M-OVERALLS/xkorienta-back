import connectDB from "@/lib/mongodb";
import Exam from "@/models/Exam";
import { NextResponse } from "next/server";

/**
 * GET /api/exams/public
 *
 * Liste des examens publics accessibles à tous les apprenants.
 * (Sans professeur assigné ou marqués comme démos publiques)
 *
 * Query params:
 *   ?levelId=string    Filtrer par niveau (optionnel)
 *   ?subjectId=string  Filtrer par matière (optionnel)
 *   ?page=number       Pagination
 *   ?limit=number      Limite par page
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const levelId = searchParams.get("levelId");
    const subjectId = searchParams.get("subjectId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    await connectDB();

    // Filtre de base : examens publiés et soit PublicDemo soit sans restriction spécifique
    const filter: any = {
      isPublished: true,
      isActive: true,
      // Pour l'instant, on considère que tous les examens publiés sont "publics"
      // s'ils ne sont pas explicitement restreints (la restriction se fait au niveau de l'accès/classe)
    };

    // Si on veut être restrictif aux démos publiques comme proposé dans le modèle
    // filter.isPublicDemo = true

    if (levelId) {
      filter.targetLevels = levelId;
    }

    if (subjectId) {
      filter.subject = subjectId;
    }

    const [exams, total] = await Promise.all([
      Exam.find(filter)
        .populate("subject", "name")
        .populate("targetLevels", "name")
        .populate("createdById", "name")
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Exam.countDocuments(filter),
    ]);

    // Formatter la réponse selon le design doc
    const formattedExams = exams.map((exam: any) => ({
      id: exam._id.toString(),
      title: exam.title,
      description: exam.description,
      subject: exam.subject
        ? { id: exam.subject._id, name: exam.subject.name }
        : null,
      level: exam.targetLevels?.[0]
        ? { id: exam.targetLevels[0]._id, name: exam.targetLevels[0].name }
        : null,
      creatorName: exam.createdById?.name || "Instructeur Xkorienta",
      difficulty: exam.difficultyLevel,
      questionCount: 0, // TODO: Serait idéal d'avoir le count ou de le fetch
    }));

    return NextResponse.json(
      {
        exams: formattedExams,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des examens publics" },
      { status: 500 },
    );
  }
}
