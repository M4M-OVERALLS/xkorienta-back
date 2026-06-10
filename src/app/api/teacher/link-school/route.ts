import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolService } from "@/lib/services/SchoolService";
import { UserRole } from "@/models/enums";

/**
 * POST /api/teacher/link-school
 * Link a teacher to a school (apply/join request)
 */
export async function POST(req: Request) {
    try {
        // Vérifier l'authentification
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non authentifié" },
                { status: 401 }
            );
        }

        // Vérifier le rôle enseignant
        if (session.user.role !== UserRole.TEACHER) {
            return NextResponse.json(
                { success: false, message: "Accès réservé aux enseignants" },
                { status: 403 }
            );
        }

        // Connexion à la base de données
        await connectDB();

        // Récupérer le schoolId du body
        const body = await req.json();
        const { schoolId } = body;

        if (!schoolId) {
            return NextResponse.json(
                { success: false, message: "School ID est requis" },
                { status: 400 }
            );
        }

        // Appliquer à l'école via le service
        const result = await SchoolService.applyToSchool(schoolId, session.user.id);

        return NextResponse.json(result);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("[Teacher Link School] Error:", error);

        // Gérer les erreurs spécifiques
        if (errorMessage === "School not found") {
            return NextResponse.json(
                { success: false, message: "École non trouvée" },
                { status: 404 }
            );
        }

        if (errorMessage.includes("already a member")) {
            return NextResponse.json(
                { success: false, message: "Vous êtes déjà membre de cette école" },
                { status: 400 }
            );
        }

        if (errorMessage.includes("already applied")) {
            return NextResponse.json(
                { success: false, message: "Vous avez déjà postulé à cette école" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Erreur interne du serveur" },
            { status: 500 }
        );
    }
}
