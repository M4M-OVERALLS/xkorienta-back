import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { EducationStructureController } from "@/lib/controllers/EducationStructureController";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/fields/[id]
 * Récupère une filière par ID avec sa hiérarchie
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    await connectDB();
    const { id } = await params;
    return EducationStructureController.getFieldById(id);
}

/**
 * PUT /api/fields/[id]
 * Met à jour une filière (Admin only)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    return EducationStructureController.updateField(req, id, session.user.id);
}

/**
 * DELETE /api/fields/[id]
 * Supprime (soft delete) une filière (Admin only)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    return EducationStructureController.deleteField(id, session.user.id);
}
