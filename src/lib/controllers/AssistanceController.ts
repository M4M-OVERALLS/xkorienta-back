import { NextResponse } from "next/server";
import { AssistanceService } from "@/lib/services/AssistanceService";

export class AssistanceController {
    static async createRequest(req: Request, studentId: string) {
        try {
            const body = await req.json();
            const { type, title, description } = body;

            if (!type || !title || !description) {
                return NextResponse.json(
                    { success: false, message: "type, title, and description are required" },
                    { status: 400 }
                );
            }

            const request = await AssistanceService.createRequest(body, studentId);

            return NextResponse.json({
                success: true,
                request: {
                    id: request._id,
                    type: request.type,
                    title: request.title,
                    status: request.status,
                    createdAt: request.createdAt
                }
            });

        } catch (error: any) {
            console.error("[Assistance Controller] Create Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getStudentRequests(req: Request, studentId: string) {
        try {
            const requests = await AssistanceService.getStudentRequests(studentId);

            return NextResponse.json({
                success: true,
                requests: requests.map((r: any) => ({
                    id: r._id.toString(),
                    type: r.type,
                    title: r.title,
                    description: r.description,
                    priority: r.priority,
                    status: r.status,
                    createdAt: r.createdAt,
                    resolution: r.resolution
                }))
            });

        } catch (error: any) {
            console.error("[Assistance Controller] Get Requests Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
