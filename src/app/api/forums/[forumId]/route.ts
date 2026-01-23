import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ForumController } from "@/lib/controllers/ForumController";

interface RouteParams {
    params: Promise<{ forumId: string }>;
}

/**
 * GET /api/forums/[forumId]
 * Get forum details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId } = await params;
    return ForumController.getForumById(forumId, session.user.id);
}

/**
 * PUT /api/forums/[forumId]
 * Update forum settings
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId } = await params;
    return ForumController.updateForum(request, forumId, session.user.id);
}

/**
 * DELETE /api/forums/[forumId]
 * Archive (soft delete) a forum
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId } = await params;
    return ForumController.archiveForum(forumId, session.user.id);
}
