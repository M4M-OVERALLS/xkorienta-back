import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { EducationStructureController } from "@/lib/controllers/EducationStructureController";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/learning-units/[id]
 * Récupère une unité d'apprentissage par ID avec sa hiérarchie
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    await connectDB();
    const { id } = await params;
    return EducationStructureController.getLearningUnitById(id);
}

/**
 * PUT /api/learning-units/[id]
 * Met à jour une unité d'apprentissage (Teacher/Admin)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    const { id } = await params;
    return EducationStructureController.updateLearningUnit(req, id);
}

/**
 * DELETE /api/learning-units/[id]
 * Supprime (soft delete) une unité d'apprentissage (Teacher/Admin)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    const { id } = await params;
    return EducationStructureController.deleteLearningUnit(id);
}
