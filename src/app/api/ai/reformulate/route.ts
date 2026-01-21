import { NextResponse } from "next/server";
import { HuggingFaceService } from "@/lib/services/HuggingFaceService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { text, options, seed } = body;

        if (!text) {
            return NextResponse.json({ message: "Text is required" }, { status: 400 });
        }

        const result = await HuggingFaceService.reformulateText(text, options, seed);

        return NextResponse.json({ text: result });
    } catch (error: any) {
        console.error("[AI Reformulate API] Error:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
