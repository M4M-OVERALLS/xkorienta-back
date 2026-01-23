import { NextResponse } from "next/server";
import { PredictionEngine } from "@/lib/services/PredictionEngine";
import { UserRole } from "@/models/enums";

export class PredictionController {
    /**
     * GET /api/predictions
     * Get predictions and analytics for students
     */
    static async getPredictions(
        userId: string,
        role: UserRole,
        queryParams: {
            type?: string;
            studentId?: string;
            classId?: string;
            syllabusId?: string;
            schoolId?: string;
            passingScore?: string;
            anonymize?: string;
            weeks?: string;
        }
    ) {
        try {
            if (!userId) {
                return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
            }
            const {
                type,
                studentId = userId,
                classId,
                syllabusId,
                schoolId,
                passingScore,
                anonymize,
                weeks
            } = queryParams;

            // Students can only access their own predictions
            if (role === UserRole.STUDENT && studentId !== userId) {
                return NextResponse.json({ message: "Access denied" }, { status: 403 });
            }

            let result: any;

            switch (type) {
                case "score":
                    result = await PredictionEngine.predictStudentScore(studentId, syllabusId || undefined);
                    break;

                case "probability":
                    const passingScoreNum = parseInt(passingScore || "50");
                    result = await PredictionEngine.calculateSuccessProbability(studentId, passingScoreNum);
                    break;

                case "rank":
                    if (!classId) {
                        return NextResponse.json({ message: "classId required" }, { status: 400 });
                    }
                    const anonymizeBool = anonymize !== "false";
                    result = await PredictionEngine.getRankAmongPeers(studentId, classId, anonymizeBool);
                    break;

                case "class":
                    if (!classId) {
                        return NextResponse.json({ message: "classId required" }, { status: 400 });
                    }
                    // Only teachers/admins can access class-level predictions
                    if (!['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL'].includes(role)) {
                        return NextResponse.json({ message: "Access denied" }, { status: 403 });
                    }
                    result = await PredictionEngine.getClassPerformancePrediction(classId);
                    break;

                case "risk":
                    // Only teachers/admins can access risk assessments
                    if (!['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL'].includes(role)) {
                        return NextResponse.json({ message: "Access denied" }, { status: 403 });
                    }
                    result = await PredictionEngine.detectDropoutRisk(studentId);
                    break;

                case "weak":
                    result = await PredictionEngine.identifyWeakConcepts(studentId, syllabusId || undefined);
                    break;

                case "trend":
                    const weeksNum = parseInt(weeks || "8");
                    result = await PredictionEngine.getProgressionTrend(studentId, weeksNum);
                    break;

                case "benchmark":
                    if (!schoolId) {
                        return NextResponse.json({ message: "schoolId required" }, { status: 400 });
                    }
                    // Only teachers/admins can access benchmarks
                    if (!['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL', 'RECTOR'].includes(role)) {
                        return NextResponse.json({ message: "Access denied" }, { status: 403 });
                    }
                    result = await PredictionEngine.getBenchmark(schoolId);
                    break;

                case "risk-students":
                    if (!classId) {
                        return NextResponse.json({ message: "classId required" }, { status: 400 });
                    }
                    // Only teachers/admins can access
                    if (!['TEACHER', 'SCHOOL_ADMIN', 'INSPECTOR', 'PRINCIPAL'].includes(role)) {
                        return NextResponse.json({ message: "Access denied" }, { status: 403 });
                    }
                    result = await PredictionEngine.getAtRiskStudentsForClass(classId);
                    break;

                default:
                    // Return all available predictions for a student
                    result = {
                        score: await PredictionEngine.predictStudentScore(studentId, syllabusId || undefined),
                        probability: await PredictionEngine.calculateSuccessProbability(studentId),
                        weakConcepts: await PredictionEngine.identifyWeakConcepts(studentId, syllabusId || undefined),
                        trend: await PredictionEngine.getProgressionTrend(studentId, 8)
                    };
            }

            return NextResponse.json(result);
        } catch (error: any) {
            console.error("[Prediction Controller] Error:", error);
            return NextResponse.json(
                { message: error.message || "Something went wrong" },
                { status: 500 }
            );
        }
    }
}
