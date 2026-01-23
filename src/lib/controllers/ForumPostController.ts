import { NextResponse } from "next/server";
import { ForumPostService } from "@/lib/services/ForumPostService";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";

export class ForumPostController {
    private static forumPostService = new ForumPostService();

    /**
     * GET /api/forums/[forumId]/posts
     * Get posts for a forum
     */
    static async getPosts(forumId: string, page: number, limit: number) {
        try {
            if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
                return NextResponse.json({ error: "Invalid forum ID" }, { status: 400 });
            }

            const result = await this.forumPostService.getPosts(forumId, page, limit);

            return NextResponse.json({
                success: true,
                data: result.posts,
                pagination: result.pagination
            });
        } catch (error: any) {
            console.error("[ForumPost Controller] Get Posts Error:", error);
            if (error.message === "Forum non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * POST /api/forums/[forumId]/posts
     * Create a new post in forum
     */
    static async createPost(
        req: Request,
        forumId: string,
        userId: string,
        userRole: UserRole
    ) {
        try {
            if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
                return NextResponse.json({ error: "Invalid forum ID" }, { status: 400 });
            }

            const body = await req.json();
            const { title, content, isAnnouncement } = body;

            if (!content || content.trim().length === 0) {
                return NextResponse.json({ error: "Le contenu est requis" }, { status: 400 });
            }

            const post = await this.forumPostService.createPost(forumId, userId, userRole, {
                title,
                content,
                isAnnouncement
            });

            return NextResponse.json({
                success: true,
                data: post
            }, { status: 201 });
        } catch (error: any) {
            console.error("[ForumPost Controller] Create Post Error:", error);
            if (error.message === "Forum non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            if (error.message.includes("membre") || error.message.includes("étudiants")) {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * POST /api/forums/[forumId]/posts/[postId]/replies
     * Add a reply to a post
     */
    static async addReply(
        req: Request,
        forumId: string,
        postId: string,
        userId: string,
        userInfo: {
            name?: string | null;
            image?: string | null;
            role?: string | null;
        }
    ) {
        try {
            if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
                return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
            }

            const body = await req.json();
            const { content } = body;

            if (!content || content.trim().length === 0) {
                return NextResponse.json({ error: "Le contenu est requis" }, { status: 400 });
            }

            const reply = await this.forumPostService.addReply(forumId, postId, userId, content, userInfo);

            return NextResponse.json({
                success: true,
                data: reply
            }, { status: 201 });
        } catch (error: any) {
            console.error("[ForumPost Controller] Add Reply Error:", error);
            if (error.message === "Post non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }
}
