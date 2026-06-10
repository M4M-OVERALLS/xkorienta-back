import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import School from "@/models/School";
import { SchoolStatus, UserRole } from "@/models/enums";
import { GamificationService, XPSource } from "@/lib/services/GamificationService";

/**
 * POST /api/student/schools/link
 * Permet à un apprenant de lier son compte à une école validée.
 * Récompense : +75 XP (SCHOOL_LINKED)
 * 
 * Body: { schoolId: string, classId?: string }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            );
        }

        await connectDB();

        const userId = session.user.id;
        const body = await req.json();
        const { schoolId } = body;

        if (!schoolId) {
            return NextResponse.json(
                { success: false, message: "schoolId requis" },
                { status: 400 }
            );
        }

        // Verify school exists and is validated
        const school = await School.findById(schoolId).lean();
        if (!school) {
            return NextResponse.json(
                { success: false, message: "École introuvable" },
                { status: 404 }
            );
        }

        if ((school as any).status !== SchoolStatus.VALIDATED) {
            return NextResponse.json(
                { success: false, message: "Seules les écoles validées peuvent être liées" },
                { status: 400 }
            );
        }

        // Check user is a student
        const user = await User.findById(userId);
        if (!user || user.role !== UserRole.STUDENT) {
            return NextResponse.json(
                { success: false, message: "Réservé aux apprenants" },
                { status: 403 }
            );
        }

        // Check if already linked to this school
        const alreadyLinked = user.schools?.some(
            (s: any) => s.toString() === schoolId
        );
        if (alreadyLinked) {
            return NextResponse.json(
                { success: false, message: "Vous êtes déjà lié à cet établissement" },
                { status: 400 }
            );
        }

        // Link school
        if (!user.schools) user.schools = [];
        user.schools.push(schoolId);
        await user.save();

        // Award XP bonus
        const xpTransaction = await GamificationService.awardXP(
            userId,
            XPSource.SCHOOL_LINKED,
            {
                sourceId: schoolId,
                description: `Liaison à l'établissement ${(school as any).name}`
            }
        );

        return NextResponse.json({
            success: true,
            message: `Vous êtes maintenant lié à ${(school as any).name}`,
            xpAwarded: xpTransaction.amount,
            school: {
                id: (school as any)._id,
                name: (school as any).name,
            }
        });

    } catch (error: any) {
        console.error("[Student Schools Link] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Erreur interne" },
            { status: 500 }
        );
    }
}
