import { NextResponse } from "next/server";
import { RegistrationService } from "@/lib/services/RegistrationService";
import { z } from "zod";
import { sanitizeString, sanitizeEmail, validatePassword } from "@/lib/security/sanitize";

const registrationService = new RegistrationService();

export class RegistrationController {
    static async register(req: Request) {
        try {
            const data = await req.json();
            await registrationService.registerUser(data);
            return NextResponse.json({ success: true, message: "Registration successful" });

        } catch (error: any) {
            console.error("Registration Error:", error);

            // Handle specific errors with appropriate status codes
            if (error.message === "User already exists" ||
                error.message === "Invalid role" ||
                error.message === "School selection is required" ||
                error.message === "Selected school does not exist" ||
                error.message.includes("validated partner schools")) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    /**
     * Register user without role (for onboarding flow)
     */
    static async registerWithoutRole(req: Request) {
        try {
            const body = await req.json();

            // Sanitize inputs before validation
            const sanitizedBody = {
                name: sanitizeString(body.name),
                email: sanitizeEmail(body.email),
                password: body.password, // Don't sanitize password, just validate
            };

            // Validation schema
            const registerSchema = z.object({
                name: z.string().min(2).max(100),
                email: z.string().email(),
                password: z.string().min(8).max(128),
            });

            const { name, email, password } = registerSchema.parse(sanitizedBody);

            // Additional password validation
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return NextResponse.json(
                    { message: passwordValidation.message },
                    { status: 400 }
                );
            }

            const user = await registrationService.registerUserWithoutRole({ name, email, password });
            
            return NextResponse.json(
                {
                    message: "User created successfully. Please complete onboarding.",
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                    }
                },
                { status: 201 }
            );
        } catch (error: any) {
            console.error("[Registration Controller] Register Without Role Error:", error);

            if (error.name === 'ZodError') {
                return NextResponse.json(
                    { message: "Invalid input data" },
                    { status: 400 }
                );
            }

            if (error.message === "User already exists") {
                return NextResponse.json(
                    { message: error.message },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
