import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { UserRole } from "@/models/enums";
import { ForumController } from "@/lib/controllers/ForumController";

/**
 * GET /api/forums
 * List forums for the current user
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
        classId: searchParams.get("classId") || undefined,
        type: searchParams.get("type") || undefined
    };

    const role = session.user.role as UserRole;
    return ForumController.getForums(session.user.id, role, queryParams);
}

/**
 * POST /api/forums
 * Create a new forum
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const role = session.user.role as UserRole;
    return ForumController.createForum(request, session.user.id, role);
}
