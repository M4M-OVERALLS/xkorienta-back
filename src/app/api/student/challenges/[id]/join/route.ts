import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * POST /api/student/challenges/:id/join
 * Join a challenge
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return StudentController.joinChallenge("", "");
    }

    const { id } = await params;
    return StudentController.joinChallenge(session.user.id, id);
}
