import { NextResponse } from "next/server";
import { AttemptService } from "@/lib/services/AttemptService";

export class AttemptController {
    static async recordAntiCheatEvent(req: Request, attemptId: string, userId: string) {
        try {
            const body = await req.json();
            const { type, data } = body;

            if (!type) {
                return NextResponse.json(
                    { success: false, message: "event type is required" },
                    { status: 400 }
                );
            }

            const validTypes = [
                'tab_switch',
                'copy_paste',
                'right_click',
                'screenshot',
                'fullscreen_exit',
                'window_blur',
                'context_menu'
            ];

            if (!validTypes.includes(type)) {
                return NextResponse.json(
                    { success: false, message: `Invalid event type. Must be one of: ${validTypes.join(', ')}` },
                    { status: 400 }
                );
            }

            const result = await AttemptService.recordAntiCheatEvent(
                attemptId,
                userId,
                type,
                data
            );

            return NextResponse.json({
                success: true,
                data: result,
                message: "Anti-cheat event recorded"
            });

        } catch (error: any) {
            console.error("[Attempt Controller] AntiCheat Error:", error);

            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("Unauthorized") ||
                error.message.includes("not in progress") ||
                error.message.includes("Maximum tab switches")) {
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

    static async resumeAttempt(req: Request, attemptId: string, userId: string) {
        try {
            const body = await req.json();
            const { resumeToken } = body;

            if (!resumeToken) {
                return NextResponse.json(
                    { success: false, message: "resumeToken is required" },
                    { status: 400 }
                );
            }

            const result = await AttemptService.resumeAttempt(
                attemptId,
                resumeToken,
                userId
            );

            return NextResponse.json({
                success: true,
                data: result,
                message: "Attempt resumed successfully"
            });
        } catch (error: any) {
            console.error("[Attempt Controller] Resume Error:", error);

            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("Invalid token") ||
                error.message.includes("Unauthorized") ||
                error.message.includes("not in progress")) {
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

    static async submitAttempt(req: Request, attemptId: string, userId: string) {
        try {
            const body = await req.json();
            const { responses } = body;

            if (!responses || !Array.isArray(responses)) {
                return NextResponse.json(
                    { success: false, message: "responses array is required" },
                    { status: 400 }
                );
            }

            const result = await AttemptService.submitAttempt(
                attemptId,
                userId,
                responses
            );

            return NextResponse.json({
                success: true,
                data: {
                    attempt: result.attempt,
                    evaluation: result.evaluation,
                    totalResponses: result.responses.length
                },
                message: "Attempt submitted and evaluated successfully"
            });
        } catch (error: any) {
            console.error("[Attempt Controller] Submit Error:", error);

            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("Unauthorized") ||
                error.message.includes("not in progress")) {
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

    static async getAttempt(attemptId: string, userId: string) {
        try {
            const attempt = await AttemptService.getAttempt(attemptId, userId);

            return NextResponse.json({
                success: true,
                data: attempt
            });
        } catch (error: any) {
            console.error("[Attempt Controller] Get Error:", error);

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

    static async saveAnswer(req: Request, userId: string) {
        try {
            const body = await req.json();
            const { attemptId, questionId, selectedOptionId, textResponse } = body;

            // Basic validation
            if (!attemptId || !questionId) {
                return NextResponse.json(
                    { success: false, message: "attemptId and questionId are required" },
                    { status: 400 }
                );
            }

            const result = await AttemptService.saveAnswer(
                attemptId,
                userId,
                questionId,
                selectedOptionId,
                textResponse
            );

            return NextResponse.json(result);
        } catch (error: any) {
            console.error("[Attempt Controller] Save Answer Error:", error);

            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("Invalid attempt") ||
                error.message.includes("already completed")) {
                // Map specific errors to appropriate status codes if needed, or stick to generic
                // "Invalid attempt" implies Forbidden (403) or Not Found (404) logic, 
                // but let's stick to 403 for ownership/validity check or 400 for logic error.
                // The original code returned 403 for "Invalid attempt" and 400 for "Attempt already completed".
                // Let's replicate or be robust.
                const status = error.message === "Invalid attempt" ? 403 : 400;
                return NextResponse.json(
                    { message: error.message },
                    { status }
                );
            }

            return NextResponse.json(
                { message: error.message || "Something went wrong" },
                { status: 500 }
            );
        }
    }

    /**
     * POST /api/resume
     * Get redirect URL for resume token
     */
    static async getResumeRedirect(req: Request, currentUserId?: string) {
        try {
            const body = await req.json();
            const { token } = body;

            if (!token) {
                return NextResponse.json(
                    { message: "Token is required" },
                    { status: 400 }
                );
            }

            const result = await AttemptService.getResumeRedirectUrl(token, currentUserId);
            return NextResponse.json(result);
        } catch (error: any) {
            console.error("[Attempt Controller] Get Resume Redirect Error:", error);

            // Map specific errors to appropriate status codes
            if (error.message === "Invalid token") {
                return NextResponse.json(
                    { message: error.message },
                    { status: 404 }
                );
            }

            if (error.message.includes("wrong user")) {
                return NextResponse.json(
                    { message: error.message },
                    { status: 403 }
                );
            }

            return NextResponse.json(
                { message: error.message || "Something went wrong" },
                { status: 500 }
            );
        }
    }
}
