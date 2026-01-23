import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ProfileController } from "@/lib/controllers/ProfileController";
import { UserRole } from "@/models/enums";

/**
 * GET /api/profiles/learner
 * Get learner profile
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== UserRole.STUDENT) {
        return NextResponse.json({ success: false, message: "Forbidden: Not a student" }, { status: 403 });
    }

    await connectDB();
    return ProfileController.getLearnerProfile(session.user.id);
}

/**
 * PUT /api/profiles/learner
 * Update learner profile
 */
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== UserRole.STUDENT) {
        return NextResponse.json({ success: false, message: "Forbidden: Not a student" }, { status: 403 });
    }

    await connectDB();
    return ProfileController.updateLearnerProfile(req, session.user.id);
}
