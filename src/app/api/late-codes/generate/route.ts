import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { LateCodeController } from "@/lib/controllers/LateCodeController";

/**
 * POST /api/late-codes/generate
 * Génère un nouveau code d'accès tardif (Teacher only)
 * Body: {
 *   examId: string
 *   usagesRemaining?: number (default: 1)
 *   expiresAt?: Date (default: 7 days)
 *   assignedUserId?: string (optional, pour un étudiant spécifique)
 *   reason?: string
 * }
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
    return LateCodeController.generateLateCode(req, session.user.id);
}
