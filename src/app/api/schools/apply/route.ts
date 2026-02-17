import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";

/**
 * POST /api/schools/apply
 * Apply to a school
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return SchoolController.applyToSchool(req, "");
    }

    await connectDB();
    return SchoolController.applyToSchool(req, session.user.id);
}
