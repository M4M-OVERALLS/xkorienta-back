import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ConceptController } from "@/lib/controllers/ConceptController";

/**
 * POST /api/syllabus/concepts/evaluate
 * Submit a concept self-evaluation
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    return ConceptController.evaluateConcept(req, session.user.id);
}
