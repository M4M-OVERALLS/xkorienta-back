import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

/**
 * POST /api/auth/change-password
 *
 * Change le mot de passe de l'utilisateur connecté.
 * Efface le flag requiresPasswordChange après succès.
 *
 * Body: { currentPassword?: string, newPassword: string }
 *
 * - Si requiresPasswordChange = true : currentPassword non requis
 *   (l'utilisateur vient d'être créé, il n'a pas de vrai mot de passe)
 * - Sinon : currentPassword obligatoire
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { currentPassword, newPassword } = await req.json();

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { error: "Le nouveau mot de passe doit contenir au moins 8 caractères" },
                { status: 400 }
            );
        }

        await connectDB();

        const user = await User.findById(session.user.id).select("+password");
        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
        }

        // Si changement forcé → pas besoin du mot de passe actuel
        const forcedChange = (user as any).requiresPasswordChange === true;

        if (!forcedChange) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: "Mot de passe actuel requis" },
                    { status: 400 }
                );
            }
            const valid = await bcrypt.compare(currentPassword, user.password || "");
            if (!valid) {
                return NextResponse.json(
                    { error: "Mot de passe actuel incorrect" },
                    { status: 400 }
                );
            }
        }

        const hashed = await bcrypt.hash(newPassword, 12);

        const updatePayload: Record<string, unknown> = {
            password: hashed,
            requiresPasswordChange: false,
        };

        // N'incrémenter tokenVersion que pour les changements volontaires (pas le premier setup)
        // Car le frontend ne stocke pas tokenVersion dans son JWT,
        // et l'incrément invaliderait immédiatement la session courante.
        if (!forcedChange) {
            updatePayload.$inc = { tokenVersion: 1 };
        }

        await User.findByIdAndUpdate(session.user.id, updatePayload);

        return NextResponse.json({
            success: true,
            message: "Mot de passe mis à jour avec succès",
        });
    } catch (error: any) {
        Sentry.captureException(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
