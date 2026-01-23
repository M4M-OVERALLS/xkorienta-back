import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { EducationStructureController } from "@/lib/controllers/EducationStructureController";

/**
 * GET /api/learning-units
 * Récupère les unités d'apprentissage avec filtres optionnels
 * Query params: subject, parentUnit, unitType, isActive
 */
export async function GET(req: NextRequest) {
    await connectDB();
    return EducationStructureController.getLearningUnits(req);
}

/**
 * POST /api/learning-units
 * Crée une nouvelle unité d'apprentissage (Teacher/Admin)
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return EducationStructureController.createLearningUnit(req);
}
