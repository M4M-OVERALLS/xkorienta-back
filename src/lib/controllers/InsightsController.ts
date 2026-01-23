import { NextResponse } from "next/server";
import { AIInsightsService } from "@/lib/services/AIInsightsService";
import { UserRole } from "@/models/enums";

export class InsightsController {
    /**
     * GET /api/insights
     * Get AI-powered insights and recommendations for students
     */
    static async getInsights(
        userId: string,
        role: UserRole,
        queryParams: {
            type?: string;
            studentId?: string;
            limit?: string;
            minutes?: string;
        }
    ) {
        try {
            if (!userId) {
                return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
            }
            const {
                type,
                studentId = userId,
                limit,
                minutes
            } = queryParams;

            // Students can only access their own insights
            if (role === UserRole.STUDENT && studentId !== userId) {
                return NextResponse.json({ message: "Access denied" }, { status: 403 });
            }

            let result: any;

            switch (type) {
                case "insights":
                    result = await AIInsightsService.generatePersonalizedInsights(studentId);
                    break;

                case "recommendations":
                    const limitNum = parseInt(limit || "5");
                    result = await AIInsightsService.generateLearningRecommendations(studentId, limitNum);
                    break;

                case "coaching":
                    result = await AIInsightsService.generateCoachingMessage(studentId);
                    break;

                case "profile":
                    result = await AIInsightsService.buildLearningProfile(studentId);
                    break;

                case "anomalies":
                    // Only teachers/admins can access anomaly detection
                    if (!['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL'].includes(role)) {
                        return NextResponse.json({ message: "Access denied" }, { status: 403 });
                    }
                    result = await AIInsightsService.detectAnomalies(studentId);
                    break;

                case "forecast":
                    result = await AIInsightsService.generatePerformanceForecast(studentId);
                    break;

                case "plan":
                    const minutesNum = parseInt(minutes || "60");
                    result = await AIInsightsService.generateDailyStudyPlan(studentId, minutesNum);
                    break;

                default:
                    // Return comprehensive insights bundle
                    const [insights, recommendations, coaching, forecast] = await Promise.all([
                        AIInsightsService.generatePersonalizedInsights(studentId),
                        AIInsightsService.generateLearningRecommendations(studentId, 5),
                        AIInsightsService.generateCoachingMessage(studentId),
                        AIInsightsService.generatePerformanceForecast(studentId)
                    ]);

                    result = {
                        insights,
                        recommendations,
                        coaching,
                        forecast
                    };
            }

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("[Insights Controller] Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Something went wrong" },
                { status: 500 }
            );
        }
    }
}
