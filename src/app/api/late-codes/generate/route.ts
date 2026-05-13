import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { LateCodeController } from "@/lib/controllers/LateCodeController";
import { lateCodeGenerateLimiter, createRateLimitResponse } from "@/lib/security/rateLimiter";

/**
 * POST /api/late-codes/generate
 * Génère un nouveau code d'accès tardif (Teacher only)
 * Rate-limit: 20 générations/h/user (A-17)
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

    // A-17: Rate-limit 20 generations per hour per user
    const rateLimitResult = lateCodeGenerateLimiter(session.user.id);
    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime);
    }

    await connectDB();
    return LateCodeController.generateLateCode(req, session.user.id);
}
