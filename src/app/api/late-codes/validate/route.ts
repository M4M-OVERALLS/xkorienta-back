import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { LateCodeController } from "@/lib/controllers/LateCodeController";
import { rateLimitCheck, rateLimitConsume, getClientIdentifier, createRateLimitResponse } from "@/lib/security/rateLimiter";

const VALIDATE_FAIL_CONFIG = { windowMs: 60 * 60 * 1000, maxRequests: 5 };

/**
 * POST /api/late-codes/validate
 * Valide et utilise un code d'accès tardif (Student)
 * Rate-limit: 5 échecs/h/IP — only failures consume quota (A-17)
 * Body: {
 *   code: string
 *   examId: string
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

    // A-17: Check failure rate-limit (5 failures/h/IP) — check without consuming
    const ip = getClientIdentifier(req);
    const rateLimitKey = `validate-fail:${ip}`;
    const check = rateLimitCheck(VALIDATE_FAIL_CONFIG, rateLimitKey);
    if (!check.allowed) {
        return createRateLimitResponse(check.resetTime);
    }

    await connectDB();
    const response = await LateCodeController.validateLateCode(req, session.user.id);

    // Only consume a rate-limit token on failure (non-200 response)
    if (response.status !== 200) {
        rateLimitConsume(VALIDATE_FAIL_CONFIG, rateLimitKey);
    }

    return response;
}
