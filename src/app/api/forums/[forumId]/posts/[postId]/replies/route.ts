import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ForumPostController } from "@/lib/controllers/ForumPostController";

interface RouteParams {
    params: Promise<{ forumId: string; postId: string }>;
}

/**
 * POST /api/forums/[forumId]/posts/[postId]/replies
 * Add a reply to a post
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await connectDB();
    const { forumId, postId } = await params;

    return ForumPostController.addReply(
        request,
        forumId,
        postId,
        session.user.id,
        {
            name: session.user.name,
            image: session.user.image,
            role: session.user.role
        }
    );
}
