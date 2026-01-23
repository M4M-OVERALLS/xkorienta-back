import { NextResponse } from "next/server";
import { ForumService } from "@/lib/services/ForumService";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";

export class ForumController {
    private static forumService = new ForumService();

    /**
     * GET /api/forums
     * List forums for the current user
     */
    static async getForums(
        userId: string,
        role: UserRole,
        queryParams: {
            classId?: string;
            type?: string;
        }
    ) {
        try {
            const forums = await this.forumService.getForums(userId, role, queryParams);

            return NextResponse.json({
                success: true,
                data: forums
            });
        } catch (error: any) {
            console.error("[Forum Controller] Get Forums Error:", error);
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * POST /api/forums
     * Create a new forum
     */
    static async createForum(req: Request, userId: string, role: UserRole) {
        try {
            const body = await req.json();
            const { name, description, type, classId, subjectId, isPrivate, allowStudentPosts } = body;

            if (!name) {
                return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
            }

            // Validate classId if provided
            if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
                return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
            }

            // Validate subjectId if provided
            if (subjectId && !mongoose.Types.ObjectId.isValid(subjectId)) {
                return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
            }

            const forum = await this.forumService.createForum(userId, role, {
                name,
                description,
                type,
                classId,
                subjectId,
                isPrivate,
                allowStudentPosts
            });

            return NextResponse.json({
                success: true,
                data: forum
            }, { status: 201 });
        } catch (error: any) {
            console.error("[Forum Controller] Create Forum Error:", error);
            if (error.message === "Seuls les enseignants peuvent créer des forums") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
            if (error.message === "Le nom est requis") {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * GET /api/forums/[forumId]
     * Get forum details
     */
    static async getForumById(forumId: string, userId: string) {
        try {
            if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
                return NextResponse.json({ error: "Invalid forum ID" }, { status: 400 });
            }

            const forum = await this.forumService.getForumById(forumId, userId);

            return NextResponse.json({
                success: true,
                data: forum
            });
        } catch (error: any) {
            console.error("[Forum Controller] Get Forum By ID Error:", error);
            if (error.message === "Forum non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            if (error.message === "Accès non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * PUT /api/forums/[forumId]
     * Update forum settings
     */
    static async updateForum(req: Request, forumId: string, userId: string) {
        try {
            if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
                return NextResponse.json({ error: "Invalid forum ID" }, { status: 400 });
            }

            const body = await req.json();
            const { name, description, isPrivate, allowStudentPosts, status } = body;

            const forum = await this.forumService.updateForum(forumId, userId, {
                name,
                description,
                isPrivate,
                allowStudentPosts,
                status
            });

            return NextResponse.json({
                success: true,
                data: forum
            });
        } catch (error: any) {
            console.error("[Forum Controller] Update Forum Error:", error);
            if (error.message === "Forum non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            if (error.message === "Non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * DELETE /api/forums/[forumId]
     * Archive (soft delete) a forum
     */
    static async archiveForum(forumId: string, userId: string) {
        try {
            if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
                return NextResponse.json({ error: "Invalid forum ID" }, { status: 400 });
            }

            await this.forumService.archiveForum(forumId, userId);

            return NextResponse.json({
                success: true,
                message: "Forum archivé"
            });
        } catch (error: any) {
            console.error("[Forum Controller] Archive Forum Error:", error);
            if (error.message === "Forum non trouvé") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            if (error.message === "Non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }
}
