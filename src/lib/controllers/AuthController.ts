import { NextResponse } from "next/server";
import { AuthService } from "@/lib/services/AuthService";

const authService = new AuthService();

export class AuthController {
    static async verify(req: Request) {
        try {
            const body = await req.json();
            const { email, password } = body;

            if (!email || !password) {
                return NextResponse.json(
                    { message: "Email and password are required" },
                    { status: 400 }
                );
            }

            const user = await authService.verifyCredentials(email, password);

            if (!user) {
                return NextResponse.json(
                    { message: "Invalid credentials" },
                    { status: 401 }
                );
            }

            return NextResponse.json(user);

        } catch (error: any) {
            console.error("Auth Verify Error:", error);
            if (error.message === "Email and password are required") {
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

    static async getProviders() {
        try {
            const data = authService.getAuthProviders();
            return NextResponse.json(data);
        } catch (error: any) {
            console.error("[AuthController] Get Providers Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch providers" },
                { status: 500 }
            );
        }
    }

    static async verifyGoogle(req: Request) {
        try {
            const body = await req.json();
            const { idToken, user } = body || {};

            const data = await authService.verifyGoogle(idToken, user);
            return NextResponse.json(data);
        } catch (error: any) {
            console.error("[AuthController] Google Verify Error:", error);
            const status = error.status || 500;
            return NextResponse.json(
                { message: error.message || "Internal server error" },
                { status }
            );
        }
    }

    static async forgotPassword(req: Request) {
        try {
            const body = await req.json();
            const { email } = body;

            if (!email) {
                return NextResponse.json(
                    { success: false, message: "L'email est requis" },
                    { status: 400 }
                );
            }

            const result = await authService.requestPasswordReset(email);
            return NextResponse.json({
                success: true,
                message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
            });
        } catch (error: any) {
            console.error("[AuthController] Forgot Password Error:", error);
            // Always return success to prevent email enumeration
            return NextResponse.json({
                success: true,
                message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
            });
        }
    }

    static async resetPassword(req: Request) {
        try {
            const body = await req.json();
            const { token, password } = body;

            if (!token || !password) {
                return NextResponse.json(
                    { success: false, message: "Token et mot de passe requis" },
                    { status: 400 }
                );
            }

            const result = await authService.resetPassword(token, password);
            return NextResponse.json({
                success: true,
                message: "Mot de passe réinitialisé avec succès"
            });
        } catch (error: any) {
            console.error("[AuthController] Reset Password Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Erreur lors de la réinitialisation" },
                { status: 400 }
            );
        }
    }
}
