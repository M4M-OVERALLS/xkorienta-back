import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ConceptEvaluationRepository } from "@/lib/repositories/ConceptEvaluationRepository";
import { MasteryLevel } from "@/models/ConceptEvaluation";

/**
 * GET /api/self-assessment/analytics
 * Get analytics data for student's self-assessments
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    await connectDB();

    try {
        const repo = new ConceptEvaluationRepository();
        const evaluations = await repo.findByStudent(session.user.id);

        // Calculate statistics
        const totalEvaluations = evaluations.length;
        
        // Distribution by mastery level
        const levelDistribution: Record<string, number> = {};
        Object.values(MasteryLevel).forEach(level => {
            levelDistribution[level] = 0;
        });
        
        evaluations.forEach(e => {
            const evalData = e as unknown as { level: MasteryLevel };
            if (evalData.level) {
                levelDistribution[evalData.level]++;
            }
        });

        // Calculate progression over time (group by week)
        const progressionMap = new Map<string, { total: number; count: number }>();
        
        evaluations.forEach(e => {
            const evalData = e as unknown as { level: MasteryLevel; evaluatedAt: Date };
            if (!evalData.evaluatedAt) return;
            
            const week = new Date(evalData.evaluatedAt).toISOString().slice(0, 7); // YYYY-MM
            const levelValue = Object.values(MasteryLevel).indexOf(evalData.level);
            
            const current = progressionMap.get(week) || { total: 0, count: 0 };
            current.total += levelValue;
            current.count++;
            progressionMap.set(week, current);
        });

        const progression = Array.from(progressionMap.entries())
            .map(([period, data]) => ({
                period,
                averageLevel: data.total / data.count,
                count: data.count
            }))
            .sort((a, b) => a.period.localeCompare(b.period));

        // Calculate average mastery level
        const totalLevelValue = evaluations.reduce((sum, e) => {
            const evalData = e as unknown as { level: MasteryLevel };
            return sum + Object.values(MasteryLevel).indexOf(evalData.level);
        }, 0);
        
        const averageMasteryLevel = totalEvaluations > 0 
            ? totalLevelValue / totalEvaluations 
            : 0;

        // Recent evaluations (last 5)
        const recentEvaluations = evaluations
            .sort((a, b) => {
                const aDate = (a as unknown as { evaluatedAt: Date }).evaluatedAt;
                const bDate = (b as unknown as { evaluatedAt: Date }).evaluatedAt;
                return new Date(bDate).getTime() - new Date(aDate).getTime();
            })
            .slice(0, 5)
            .map(e => {
                const evalData = e as unknown as Record<string, unknown>;
                return {
                    id: evalData._id,
                    level: evalData.level,
                    evaluatedAt: evalData.evaluatedAt,
                    reflection: evalData.reflection
                };
            });

        return new Response(JSON.stringify({
            success: true,
            data: {
                totalEvaluations,
                averageMasteryLevel,
                levelDistribution,
                progression,
                recentEvaluations
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[Self-Assessment Analytics] Error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: error.message || "Something went wrong" 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
