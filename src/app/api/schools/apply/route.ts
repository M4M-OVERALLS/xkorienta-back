import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    return SchoolController.applyToSchool(req, session.user.id);
}
