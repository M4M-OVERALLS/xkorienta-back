import { NextResponse } from "next/server";
import { OnboardingService } from "../services/OnboardingService";

export class OnboardingController {
    private static onboardingService = new OnboardingService();

    /**
     * Handle onboarding submission
     */
    static async submit(role: string, details: any, userEmail: string) {
        try {
            if (!role || !["STUDENT", "TEACHER"].includes(role)) {
                return NextResponse.json(
                    { message: "Invalid role selected" },
                    { status: 400 }
                );
            }

            const user = await this.onboardingService.completeOnboarding(userEmail, role, details);

            return NextResponse.json(
                { message: "Onboarding completed successfully", user },
                { status: 200 }
            );
        } catch (error: any) {
            console.error("[Onboarding Controller] Error:", error);

            if (error.message === "User not found") {
                return NextResponse.json({ message: error.message }, { status: 404 });
            }
            if (error.message === "Role already assigned") {
                return NextResponse.json({ message: error.message }, { status: 400 });
            }

            return NextResponse.json(
                { message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
