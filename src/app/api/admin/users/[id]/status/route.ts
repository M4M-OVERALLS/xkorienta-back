import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { UserRole } from "@/models/enums"

const ADMIN_ROLES = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * PATCH /api/admin/users/[id]/status
 * Block or unblock a user (toggle isActive).
 * Body: { isActive: boolean }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: "Accès réservé aux administrateurs" }, { status: 403 })
        }

        const { id } = await params

        if (id === session.user.id) {
            return NextResponse.json({ success: false, message: "Impossible de bloquer son propre compte" }, { status: 400 })
        }

        const body = await req.json() as { isActive?: boolean }
        if (typeof body.isActive !== "boolean") {
            return NextResponse.json({ success: false, message: "isActive (boolean) est requis" }, { status: 400 })
        }

        await connectDB()

        const user = await User.findByIdAndUpdate(
            id,
            { isActive: body.isActive },
            { new: true, select: "name email role isActive" }
        ).lean()

        if (!user) {
            return NextResponse.json({ success: false, message: "Utilisateur introuvable" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: user })
    } catch (error: any) {
        console.error("[Admin Users PATCH status]", error)
        return NextResponse.json({ success: false, message: error.message || "Erreur serveur" }, { status: 500 })
    }
}
