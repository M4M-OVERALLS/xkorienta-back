import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";

/**
 * GET /api/student/schools
 * Liste des écoles pour l'apprenant (filtrage côté frontend).
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || undefined;
    const query = searchParams.get("query") || undefined;
    const country = searchParams.get("country") || undefined;
    const city = searchParams.get("city") || undefined;
    const level = searchParams.get("level") || undefined;
    const type = searchParams.get("type") || undefined;
    const specialty = searchParams.get("specialty") || undefined;
    const accreditation = searchParams.get("accreditation") || undefined;
    const modality = searchParams.get("modality") || undefined;
    const language = searchParams.get("language") || undefined;
    const costMinRaw = searchParams.get("costMin");
    const costMaxRaw = searchParams.get("costMax");
    const scoreMinRaw = searchParams.get("scoreMin");

    const costMin = costMinRaw !== null ? Number(costMinRaw) : undefined;
    const costMax = costMaxRaw !== null ? Number(costMaxRaw) : undefined;
    const scoreMin = scoreMinRaw !== null ? Number(scoreMinRaw) : undefined;

    const effectiveStudentId = studentId || session?.user?.id || undefined;

    if (!effectiveStudentId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return SchoolController.getStudentSchools(effectiveStudentId, {
        query,
        country,
        city,
        level,
        type,
        specialty,
        accreditation,
        modality,
        language,
        costMin: Number.isNaN(costMin) ? undefined : costMin,
        costMax: Number.isNaN(costMax) ? undefined : costMax,
        scoreMin: Number.isNaN(scoreMin) ? undefined : scoreMin
    });
}
