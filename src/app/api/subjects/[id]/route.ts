import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { EducationStructureController } from "@/lib/controllers/EducationStructureController";

/**
 * GET /api/subjects/[id]
 * Récupère une matière par ID avec sa hiérarchie
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await connectDB();
    const { id } = await params;
    return EducationStructureController.getSubjectById(req, id);
}

/**
 * PUT /api/subjects/[id]
 * Met à jour une matière (Admin only)
 * TODO: Implémenter via Controller → Service → Repository
 */
export async function PUT() {
    return NextResponse.json(
        { success: true, message: "Not implemented yet" },
        { status: 501 }
    );
}

/**
 * DELETE /api/subjects/[id]
 * Supprime (soft delete) une matière (Admin only)
 * TODO: Implémenter via Controller → Service → Repository
 */
export async function DELETE() {
    return NextResponse.json(
        { success: true, message: "Not implemented yet" },
        { status: 501 }
    );
}
