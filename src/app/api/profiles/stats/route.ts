import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { UserRole } from "@/models/enums";
import { ProfileController } from "@/lib/controllers/ProfileController";

/**
 * GET /api/profiles/stats
 * Récupère les statistiques détaillées du profil de l'utilisateur connecté
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const role = session.user.role as UserRole;
    return ProfileController.getProfileStats(session.user.id, role);
}
