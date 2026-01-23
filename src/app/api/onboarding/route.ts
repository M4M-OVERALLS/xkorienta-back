import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { OnboardingController } from "@/lib/controllers/OnboardingController";

/**
 * POST /api/onboarding
 * Complete user onboarding process
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json(
            { message: "Unauthorized" },
            { status: 401 }
        );
    }

    await connectDB();

    try {
        const { role, details } = await req.json();
        return await OnboardingController.submit(role, details, session.user.email);
    } catch (error) {
        console.error("[Onboarding Route] Parse body error:", error);
        return NextResponse.json(
            { message: "Invalid request body" },
            { status: 400 }
        );
    }
}
