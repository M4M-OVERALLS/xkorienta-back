import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ProfileController } from "@/lib/controllers/ProfileController";
import { UserRole } from "@/models/enums";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Check if user has a pedagogical role
    const pedagogicalRoles = [
        UserRole.TEACHER, UserRole.INSPECTOR, UserRole.SURVEILLANT,
        UserRole.PREFET, UserRole.PRINCIPAL, UserRole.DG_ISIMMA,
        UserRole.RECTOR, UserRole.DG_M4M, UserRole.TECH_SUPPORT
    ];

    if (!pedagogicalRoles.includes(session.user.role as UserRole)) {
        return NextResponse.json({ success: false, message: "Forbidden: Not a pedagogical user" }, { status: 403 });
    }

    await connectDB();
    return ProfileController.getPedagogicalProfile(session.user.id);
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Check role again
    const pedagogicalRoles = [
        UserRole.TEACHER, UserRole.INSPECTOR, UserRole.SURVEILLANT,
        UserRole.PREFET, UserRole.PRINCIPAL, UserRole.DG_ISIMMA,
        UserRole.RECTOR, UserRole.DG_M4M, UserRole.TECH_SUPPORT
    ];

    if (!pedagogicalRoles.includes(session.user.role as UserRole)) {
        return NextResponse.json({ success: false, message: "Forbidden: Not a pedagogical user" }, { status: 403 });
    }

    await connectDB();
    return ProfileController.updatePedagogicalProfile(req, session.user.id);
}
