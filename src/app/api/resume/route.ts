import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { AttemptController } from "@/lib/controllers/AttemptController";

/**
 * POST /api/resume
 * Get redirect URL for resume token
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;

    await connectDB();
    return AttemptController.getResumeRedirect(req, currentUserId);
}
