import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { LateCodeController } from "@/lib/controllers/LateCodeController";

/**
 * POST /api/late-codes/validate
 * Valide et utilise un code d'accès tardif (Student)
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

    await connectDB();
    return LateCodeController.validateLateCode(req, session.user.id);
}
