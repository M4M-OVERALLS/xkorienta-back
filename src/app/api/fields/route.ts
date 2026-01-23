import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { EducationStructureController } from "@/lib/controllers/EducationStructureController";

/**
 * GET /api/fields
 * Récupère les filières avec filtres optionnels
 */
export async function GET(req: NextRequest) {
    await connectDB();
    return EducationStructureController.getFields(req);
}

/**
 * POST /api/fields
 * Crée une nouvelle filière (Admin only)
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    return EducationStructureController.createField(req, session.user.id);
}
