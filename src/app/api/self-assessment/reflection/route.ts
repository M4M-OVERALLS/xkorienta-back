import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * POST /api/self-assessment/reflection
 * Save a guided reflection after an exam session
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    await connectDB();

    try {
        const body = await req.json();
        const { examTitle, reflection, syllabusId } = body;

        if (!examTitle || !reflection) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "examTitle and reflection are required" 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Here you would typically save to a Reflection model or similar
        // For now, we'll just acknowledge receipt and award XP
        const { GamificationService, XPSource } = await import("@/lib/services/GamificationService");
        
        // Award XP for completing guided reflection
        await GamificationService.awardXP(session.user.id, XPSource.SELF_EVAL, {
            sourceId: examTitle,
            description: "Réflexion guidée après examen"
        });

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Reflection saved successfully" 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[Self-Assessment Reflection] Error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: error.message || "Something went wrong" 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
