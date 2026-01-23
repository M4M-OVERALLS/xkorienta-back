import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SyllabusController } from "@/lib/controllers/SyllabusController";

/**
 * POST /api/syllabus/[id]/clone
 * Clone a syllabus for the current user
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();
    const { id } = await params;
    return SyllabusController.cloneSyllabus(req, id, session.user.id);
}
