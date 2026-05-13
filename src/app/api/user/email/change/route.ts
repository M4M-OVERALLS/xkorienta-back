import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AuthService } from "@/lib/services/AuthService"
import logger from "@/lib/utils/logger"

const authService = new AuthService()

/**
 * POST /api/user/email/change
 * A-14: Step 1 — Request email change (requires current password)
 * Sends a confirmation link to the new email address.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        const { newEmail, password } = await req.json()

        if (!newEmail || !password) {
            return NextResponse.json(
                { success: false, message: "Nouvel email et mot de passe requis" },
                { status: 400 }
            )
        }

        const result = await authService.requestEmailChange(
            session.user.id,
            newEmail,
            password,
            req.headers
        )

        return NextResponse.json({
            success: true,
            message: "Un email de confirmation a été envoyé à votre nouvelle adresse"
        })

    } catch (error: any) {
        logger.error("[Email Change] Error:", error)

        const status =
            error.message.includes("Mot de passe incorrect") ? 403 :
            error.message.includes("déjà utilisé") ? 409 :
            error.message.includes("invalide") || error.message.includes("identique") ? 400 :
            500

        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status }
        )
    }
}
