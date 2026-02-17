import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { StudentController } from "@/lib/controllers/StudentController";

const getEffectiveStudentId = async (req: Request) => {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || undefined;
    return studentId || session?.user?.id || undefined;
};

/**
 * GET /api/student/shortlist
 * Récupérer la shortlist de l'apprenant
 */
export async function GET(req: Request) {
    const effectiveStudentId = await getEffectiveStudentId(req);
    if (!effectiveStudentId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return StudentController.getStudentShortlist(effectiveStudentId);
}

/**
 * POST /api/student/shortlist
 * Ajouter un item dans la shortlist
 * body: { itemType: "school" | "specialty", itemId: string }
 */
export async function POST(req: Request) {
    const effectiveStudentId = await getEffectiveStudentId(req);
    if (!effectiveStudentId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return StudentController.addToStudentShortlist(req, effectiveStudentId);
}

/**
 * DELETE /api/student/shortlist
 * Retirer un item de la shortlist
 * body: { itemType: "school" | "specialty", itemId: string }
 */
export async function DELETE(req: Request) {
    const effectiveStudentId = await getEffectiveStudentId(req);
    if (!effectiveStudentId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return StudentController.removeFromStudentShortlist(req, effectiveStudentId);
}
