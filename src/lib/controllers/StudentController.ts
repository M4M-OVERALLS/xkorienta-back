import { NextResponse } from "next/server";
import { StudentService } from "@/lib/services/StudentService";
import { LeaderboardType, LeaderboardMetric } from "@/lib/services/LeaderboardService";

export class StudentController {
    /**
     * GET /api/student/subjects
     * Get all subjects for the current student with their progress
     */
    static async getStudentSubjects(studentId: string) {
        try {
            const subjects = await StudentService.getStudentSubjects(studentId);

            return NextResponse.json({
                success: true,
                subjects
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Subjects Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/rankings
     * Get summary of student's rankings across all leaderboards
     */
    static async getStudentRankings(studentId: string) {
        try {
            const rankings = await StudentService.getStudentRankings(studentId);

            return NextResponse.json({
                success: true,
                rankings
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Rankings Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/profile
     * Get student's learner profile
     */
    static async getStudentProfile(studentId: string) {
        try {
            const profile = await StudentService.getStudentProfile(studentId);

            if (!profile) {
                return NextResponse.json(
                    { success: false, message: "Profile not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({ success: true, data: profile });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Profile Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/orientation/schools
     * Get validated schools for student orientation
     */
    static async getOrientationSchools(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const search = searchParams.get('search') || undefined;

            const result = await StudentService.getOrientationSchools(search);

            return NextResponse.json({
                success: true,
                ...result
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Orientation Schools Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/leaderboard
     * Get leaderboard based on type (CLASS, SCHOOL_LEVEL, NATIONAL_LEVEL)
     */
    static async getLeaderboard(req: Request, studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const { searchParams } = new URL(req.url);
            const type = (searchParams.get('type') as LeaderboardType) || LeaderboardType.CLASS;
            const metric = (searchParams.get('metric') as LeaderboardMetric) || LeaderboardMetric.XP;

            const leaderboard = await StudentService.getLeaderboard(studentId, type, metric);

            if (!leaderboard) {
                return NextResponse.json({
                    success: true,
                    leaderboard: null,
                    message: "No class found for student"
                });
            }

            return NextResponse.json({
                success: true,
                leaderboard
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Leaderboard Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/gamification
     * Get gamification stats for the current student
     */
    static async getGamificationStats(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const stats = await StudentService.getGamificationStats(studentId);

            return NextResponse.json({
                success: true,
                stats
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Gamification Stats Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/exams
     * Get all exams available for the current student
     */
    static async getStudentExams(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const exams = await StudentService.getStudentExams(studentId);

            return NextResponse.json({
                success: true,
                data: exams
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Exams Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/classes
     * Get all active classes the student is enrolled in with rankings
     */
    static async getStudentClasses(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const classes = await StudentService.getStudentClasses(studentId);

            return NextResponse.json({
                success: true,
                classes
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Classes Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/challenges
     * Get all available and participated challenges for the student
     */
    static async getStudentChallenges(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const challenges = await StudentService.getStudentChallenges(studentId);

            return NextResponse.json({
                success: true,
                challenges
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Challenges Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/attempts
     * Get all completed attempts for the student with exam details
     */
    static async getStudentAttempts(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const data = await StudentService.getStudentAttempts(studentId);

            return NextResponse.json({
                success: true,
                data
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Attempts Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/student/analytics
     * Get comprehensive analytics for the current student
     */
    static async getStudentAnalytics(studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const analytics = await StudentService.getStudentAnalytics(studentId);

            return NextResponse.json({
                success: true,
                analytics
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Student Analytics Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * POST /api/self-assessment
     * Save a student's self-assessment for a concept
     */
    static async saveSelfAssessment(req: Request, studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const body = await req.json();
            const { conceptId, level, reflection, syllabusId } = body;

            if (!conceptId || !level) {
                return NextResponse.json(
                    { success: false, message: "conceptId and level are required" },
                    { status: 400 }
                );
            }

            const { ConceptEvaluationService } = await import("@/lib/services/ConceptEvaluationService");
            const evaluation = await ConceptEvaluationService.saveSelfAssessment(studentId, {
                conceptId,
                level,
                reflection,
                syllabusId
            });

            return NextResponse.json({
                success: true,
                evaluation: {
                    id: evaluation.id,
                    level: evaluation.level,
                    evaluatedAt: evaluation.evaluatedAt
                }
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Save Self-Assessment Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/self-assessment
     * Get all self-assessments for the current student
     */
    static async getSelfAssessments(req: Request, studentId: string) {
        try {
            if (!studentId) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const { searchParams } = new URL(req.url);
            const syllabusId = searchParams.get('syllabusId') || undefined;

            const { ConceptEvaluationService } = await import("@/lib/services/ConceptEvaluationService");
            const evaluations = await ConceptEvaluationService.getSelfAssessments(studentId, syllabusId);

            return NextResponse.json({
                success: true,
                evaluations
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[Student Controller] Get Self-Assessments Error:", error);
            return NextResponse.json(
                { success: false, message: errorMessage },
                { status: 500 }
            );
        }
    }
}
