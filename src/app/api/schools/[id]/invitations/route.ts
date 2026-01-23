import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { InvitationController } from "@/lib/controllers/InvitationController";

/**
 * GET /api/schools/[id]/invitations
 * Get or create an invitation link for a school
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    return InvitationController.getOrCreateSchoolLink(id, session.user.id);
}

/**
 * POST /api/schools/[id]/invitations
 * Invite teachers to a school (individual or batch)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    
    try {
        const body = await req.json();
        const { type, email, name, teachers } = body;

        return InvitationController.inviteTeachersToSchool(id, type, email, name, teachers, session.user.id);
    } catch (error) {
        console.error("[Route] Parse body error:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
}
