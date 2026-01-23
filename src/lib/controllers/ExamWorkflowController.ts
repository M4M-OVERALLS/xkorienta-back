import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ExamWorkflowService } from "@/lib/services/ExamWorkflowService";
import { UserRole } from "@/models/enums";

export class ExamWorkflowController {
    /**
     * POST /api/exams/[id]/archive
     * Archive un examen publié
     * PUBLISHED → ARCHIVED
     */
    static async archiveExam(examId: string, userId: string, userRole: UserRole) {
        try {
            if (!userId || !userRole) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid exam id" },
                    { status: 400 }
                );
            }

            const exam = await ExamWorkflowService.archiveExam(examId, userId, userRole);

            return NextResponse.json({
                success: true,
                data: exam,
                message: "Exam archived successfully"
            });
        } catch (error: any) {
            console.error("[ExamWorkflow Controller] ArchiveExam Error:", error);

            if (error.message?.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message?.includes("Unauthorized") || error.message?.includes("Cannot archive")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 403 }
                );
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}

