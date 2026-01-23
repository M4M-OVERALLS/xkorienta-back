import { NextResponse } from "next/server";
import { LateCodeService } from "@/lib/services/LateCodeService";
import mongoose from "mongoose";

export class LateCodeController {
    /**
     * POST /api/late-codes/generate
     * Generate a new late access code
     */
    static async generateLateCode(req: Request, userId: string) {
        try {
            const body = await req.json();
            const { examId, usagesRemaining, expiresAt, assignedUserId, reason } = body;

            // Validate examId
            if (!examId) {
                return NextResponse.json(
                    { success: false, message: "examId is required" },
                    { status: 400 }
                );
            }

            if (!mongoose.Types.ObjectId.isValid(examId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid examId" },
                    { status: 400 }
                );
            }

            // Validate expiresAt if provided
            let expirationDate: Date | undefined;
            if (expiresAt) {
                expirationDate = new Date(expiresAt);
                if (isNaN(expirationDate.getTime())) {
                    return NextResponse.json(
                        { success: false, message: "Invalid expiresAt date" },
                        { status: 400 }
                    );
                }
            }

            // Validate assignedUserId if provided
            if (assignedUserId && !mongoose.Types.ObjectId.isValid(assignedUserId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid assignedUserId" },
                    { status: 400 }
                );
            }

            const lateCode = await LateCodeService.generateLateCode(
                examId,
                userId,
                {
                    usagesRemaining,
                    expiresAt: expirationDate,
                    assignedUserId,
                    reason
                }
            );

            return NextResponse.json({
                success: true,
                data: {
                    _id: (lateCode as any)._id,
                    code: (lateCode as any).code,
                    examId: (lateCode as any).examId,
                    usagesRemaining: (lateCode as any).usagesRemaining,
                    expiresAt: (lateCode as any).expiresAt,
                    assignedUserId: (lateCode as any).assignedUserId,
                    reason: (lateCode as any).reason
                },
                message: "Late code generated successfully"
            }, { status: 201 });
        } catch (error: any) {
            console.error("[LateCode Controller] Generate Error:", error);

            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("Unauthorized")) {
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

    /**
     * POST /api/late-codes/validate
     * Validate and use a late access code
     */
    static async validateLateCode(req: Request, userId: string) {
        try {
            const body = await req.json();
            const { code, examId } = body;

            // Validate required fields
            if (!code || !examId) {
                return NextResponse.json(
                    { success: false, message: "code and examId are required" },
                    { status: 400 }
                );
            }

            // Validate examId format
            if (!mongoose.Types.ObjectId.isValid(examId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid examId" },
                    { status: 400 }
                );
            }

            // Normalize code (uppercase, trim)
            const normalizedCode = code.trim().toUpperCase();

            const result = await LateCodeService.validateLateCode(
                normalizedCode,
                examId,
                userId
            );

            return NextResponse.json({
                success: true,
                data: {
                    examId: result.lateCode.examId,
                    expiresAt: result.lateCode.expiresAt,
                    usagesRemaining: result.lateCode.usagesRemaining
                },
                message: result.message
            });
        } catch (error: any) {
            console.error("[LateCode Controller] Validate Error:", error);

            if (error.message.includes("Invalid") ||
                error.message.includes("expired") ||
                error.message.includes("deactivated") ||
                error.message.includes("no remaining") ||
                error.message.includes("assigned to another") ||
                error.message.includes("already used")) {
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
