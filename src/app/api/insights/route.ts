import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { UserRole } from "@/models/enums";
import { InsightsController } from "@/lib/controllers/InsightsController";

/**
 * GET /api/insights
 * Get AI-powered insights and recommendations for students
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return InsightsController.getInsights("", UserRole.STUDENT, {}); // Will return 401
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const queryParams = {
        type: searchParams.get("type") || undefined,
        studentId: searchParams.get("studentId") || undefined,
        limit: searchParams.get("limit") || undefined,
        minutes: searchParams.get("minutes") || undefined
    };

    const role = session.user.role as UserRole;
    return InsightsController.getInsights(session.user.id, role, queryParams);
}
