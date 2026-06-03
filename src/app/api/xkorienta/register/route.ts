import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import XkorientaRegistration from "@/models/XkorientaRegistration";
import { XOrientationError, BaseApplicationError, ErrorHandler, LanguageHelper } from "@/lib/errors";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
    const language = LanguageHelper.getLanguageFromRequest(req);

    try {
        await connectDB();

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw XOrientationError.invalidJsonBody(language);
        }

        const registration = await XkorientaRegistration.create(body);

        return NextResponse.json(
            { success: true, message: "Registration successful", data: registration },
            { status: 201 }
        );
    } catch (error: unknown) {
        if (error instanceof BaseApplicationError) {
            error.log();
            return NextResponse.json(error.toJSON(), { status: error.httpStatus });
        }

        const xkorErr = XOrientationError.registrationFailed(
            error instanceof Error ? error.message : "Unknown",
            language
        );
        xkorErr.log();
        return NextResponse.json(xkorErr.toJSON(), { status: xkorErr.httpStatus });
    }
}
