import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { UserRole } from "@/models/enums";
import { ForumPostController } from "@/lib/controllers/ForumPostController";

interface RouteParams {
    params: Promise<{ forumId: string }>;
}

/**
 * GET /api/forums/[forumId]/posts
 * Get posts for a forum
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    return ForumPostController.getPosts(forumId, page, limit);
}

/**
 * POST /api/forums/[forumId]/posts
 * Create a new post in forum
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId } = await params;
    const role = session.user.role as UserRole;

    return ForumPostController.createPost(request, forumId, session.user.id, role);
}
