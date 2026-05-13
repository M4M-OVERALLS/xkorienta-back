import { NextResponse } from "next/server"
import { AuthService } from "@/lib/services/AuthService"

const authService = new AuthService()

/**
 * POST /api/user/email/confirm
 * A-14: Step 2 — Confirm email change with token from the confirmation link.
 * Applies the new email and notifies the old address.
 *
 * After confirmation the user must re-login because the JWT still
 * contains the old email. The short maxAge (2h) + this forced re-login
 * ensures old sessions are effectively revoked (A-13 + A-14).
 */
export async function POST(req: Request) {
    try {
        const { token } = await req.json()

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Token requis" },
                { status: 400 }
            )
        }

        const result = await authService.confirmEmailChange(token)

        return NextResponse.json({
            success: true,
            message: "Adresse email modifiée avec succès. Veuillez vous reconnecter.",
            requireReLogin: true,
        })

    } catch (error: any) {
        console.error("[Email Confirm] Error:", error)

        const isExpired = error.message.includes("invalide") || error.message.includes("expiré")

        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: isExpired ? 410 : 500 }
        )
    }
}
