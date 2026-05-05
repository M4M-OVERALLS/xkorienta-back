import { NextResponse } from "next/server";
import { RegistrationService } from "@/lib/services/RegistrationService";
import { z } from "zod";
import { sanitizeString, sanitizeEmail, validatePassword } from "@/lib/security/sanitize";

const registrationService = new RegistrationService();

export class RegistrationController {
    static async register(req: Request) {
        try {
            const data = await req.json();
            const result = await registrationService.registerUser(data);
            
            const response: any = { 
                success: true, 
                message: "Inscription réussie",
                user: {
                    id: result._id,
                    name: result.name,
                    email: result.email,
                    phone: result.phone,
                    role: result.role,
                    awaitingSchoolValidation: result.awaitingSchoolValidation
                }
            };
            
            if (result.createdSchool) {
                response.createdSchool = {
                    id: result.createdSchool._id,
                    name: result.createdSchool.name,
                    status: result.createdSchool.status
                };
                response.message = "Inscription réussie. Votre école a été créée et vous en êtes l'administrateur.";
            }

            return NextResponse.json(response);

        } catch (error: any) {
            console.error("Registration Error:", error);

            const badRequestMessages = [
                "Un compte existe déjà",
                "Ce numéro de téléphone est déjà utilisé",
                "Invalid role",
                "School selection is required",
                "Selected school does not exist",
                "Email ou numéro de téléphone requis",
                "L'email est requis pour ce type de compte",
                "Caractères invalides détectés"
            ];

            if (badRequestMessages.some(msg => error.message.includes(msg))) {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, message: error.message || "Erreur interne du serveur" },
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
            const sanitizedBody: any = {
                name: sanitizeString(body.name),
                password: body.password, // Don't sanitize password, just validate
            };
            if (body.email) sanitizedBody.email = sanitizeEmail(body.email);
            if (body.phone) sanitizedBody.phone = body.phone?.trim();

            // Validation schema — email OR phone required
            const registerSchema = z.object({
                name: z.string().min(2).max(100),
                email: z.string().email().optional(),
                phone: z.string().min(8).max(15).regex(/^\+?[0-9]+$/, "Numéro de téléphone invalide").optional(),
                password: z.string().min(8).max(128),
            }).refine(data => data.email || data.phone, {
                message: "Email ou numéro de téléphone requis",
            });

            const { name, email, phone, password } = registerSchema.parse(sanitizedBody);

            // Additional password validation
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return NextResponse.json(
                    { message: passwordValidation.message },
                    { status: 400 }
                );
            }

            const user = await registrationService.registerUserWithoutRole({ name, email, phone, password });
            
            return NextResponse.json(
                {
                    message: "User created successfully. Please complete onboarding.",
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
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

            if (error.message === "User already exists" ||
                error.message.includes("Email ou numéro de téléphone requis")) {
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
