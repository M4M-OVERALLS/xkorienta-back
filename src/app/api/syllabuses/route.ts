import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SyllabusController } from "@/lib/controllers/SyllabusController";

/**
 * GET /api/syllabuses
 * List syllabuses with filtering
 */
export async function GET(req: Request) {
    await connectDB();
    const session = await getServerSession(authOptions);
    return SyllabusController.getSyllabuses(req, session?.user?.id);
}

/**
 * POST /api/syllabuses
 * Create a new syllabus using the Builder pattern
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    return SyllabusController.createSyllabus(req, session.user.id);
}
