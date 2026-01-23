import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { UserRole } from "@/models/enums";
import { PredictionController } from "@/lib/controllers/PredictionController";

/**
 * GET /api/predictions
 * Get predictions and analytics for students
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return PredictionController.getPredictions("", UserRole.STUDENT, {}); // Will return 401
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const queryParams = {
        type: searchParams.get("type") || undefined,
        studentId: searchParams.get("studentId") || undefined,
        classId: searchParams.get("classId") || undefined,
        syllabusId: searchParams.get("syllabusId") || undefined,
        schoolId: searchParams.get("schoolId") || undefined,
        passingScore: searchParams.get("passingScore") || undefined,
        anonymize: searchParams.get("anonymize") || undefined,
        weeks: searchParams.get("weeks") || undefined
    };

    const role = session.user.role as UserRole;
    return PredictionController.getPredictions(session.user.id, role, queryParams);
}
