import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import XkorientaRegistration from "@/models/XkorientaRegistration";

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        // Basic server-side validation can be added here if needed, 
        // strictly relying on Mongoose schema validation for now

        const registration = await XkorientaRegistration.create(body);

        return NextResponse.json({
            success: true,
            message: "Registration successful",
            data: registration
        }, { status: 201 });

    } catch (error: any) {
        console.error("Xkorienta Registration Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
