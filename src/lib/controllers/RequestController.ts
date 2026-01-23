import { NextResponse } from "next/server";
import { RequestService } from "@/lib/services/RequestService";
import { UserRole } from "@/models/enums";

export class RequestController {
    /**
     * GET /api/requests
     * List requests for current user (student or teacher)
     */
    static async getRequests(userId: string, role: UserRole, status?: string, type?: string) {
        try {
            const filters: { status?: string; type?: string } = {};
            if (status) filters.status = status;
            if (type) filters.type = type;

            const requests = await RequestService.getRequests(userId, role, filters);

            return NextResponse.json({
                success: true,
                data: requests
            });
        } catch (error: any) {
            console.error("[Request Controller] Get Requests Error:", error);
            
            if (error.message === "Rôle non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }

            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * POST /api/requests
     * Create a new assistance request (student only)
     */
    static async createRequest(req: Request, userId: string) {
        try {
            const body = await req.json();
            const { teacherId, type, subjectId, title, message, priority, relatedExamId, relatedConceptIds } = body;

            const newRequest = await RequestService.createRequest({
                teacherId,
                type,
                subjectId,
                title,
                message,
                priority,
                relatedExamId,
                relatedConceptIds
            }, userId);

            return NextResponse.json({
                success: true,
                data: newRequest
            }, { status: 201 });
        } catch (error: any) {
            console.error("[Request Controller] Create Request Error:", error);

            if (error.message === "Champs requis manquants" || error.message === "Type de demande invalide") {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * GET /api/requests/[requestId]
     * Get request details
     */
    static async getRequestById(requestId: string, userId: string) {
        try {
            const request = await RequestService.getRequestById(requestId, userId);

            return NextResponse.json({
                success: true,
                data: request
            });
        } catch (error: any) {
            console.error("[Request Controller] Get Request Error:", error);

            if (error.message === "Demande non trouvée") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            if (error.message === "Accès non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }

            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * PUT /api/requests/[requestId]
     * Update request (accept/reject/complete)
     */
    static async updateRequest(req: Request, requestId: string, userId: string) {
        try {
            const body = await req.json();
            const { status, responseMessage, scheduledAt, scheduledDuration, meetingLink, feedback } = body;

            const updatedRequest = await RequestService.updateRequest(requestId, userId, {
                status,
                responseMessage,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                scheduledDuration,
                meetingLink,
                feedback
            });

            return NextResponse.json({
                success: true,
                data: updatedRequest
            });
        } catch (error: any) {
            console.error("[Request Controller] Update Request Error:", error);

            if (error.message === "Demande non trouvée") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            if (error.message === "Accès non autorisé") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }

            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }

    /**
     * DELETE /api/requests/[requestId]
     * Cancel a request (student only, if pending)
     */
    static async cancelRequest(requestId: string, userId: string) {
        try {
            await RequestService.cancelRequest(requestId, userId);

            return NextResponse.json({
                success: true,
                message: 'Demande annulée'
            });
        } catch (error: any) {
            console.error("[Request Controller] Cancel Request Error:", error);

            if (error.message === "Demande non trouvée") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            if (error.message === "Non autorisé" || error.message === "Seules les demandes en attente peuvent être annulées") {
                return NextResponse.json({ error: error.message }, { status: error.message.includes("Non autorisé") ? 403 : 400 });
            }

            return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
    }
}
