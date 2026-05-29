import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { UserRole } from "@/models/enums"

const ADMIN_ROLES = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * PUT /api/admin/users/[id]
 * Update user name, email, role.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: "Accès réservé aux administrateurs" }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json() as { name?: string; email?: string; role?: string }

        if (!body.name?.trim()) {
            return NextResponse.json({ success: false, message: "Le nom est obligatoire" }, { status: 400 })
        }

        await connectDB()

        const user = await User.findByIdAndUpdate(
            id,
            { name: body.name.trim(), email: body.email?.trim(), role: body.role },
            { new: true, select: "name email role isActive createdAt" }
        ).lean()

        if (!user) {
            return NextResponse.json({ success: false, message: "Utilisateur introuvable" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: user })
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ success: false, message: error.message || "Erreur serveur" }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: "Accès réservé aux administrateurs" }, { status: 403 })
        }

        const { id } = await params

        // Prevent self-deletion
        if (id === session.user.id) {
            return NextResponse.json({ success: false, message: "Impossible de supprimer son propre compte" }, { status: 400 })
        }

        await connectDB()

        const user = await User.findByIdAndDelete(id)
        if (!user) {
            return NextResponse.json({ success: false, message: "Utilisateur introuvable" }, { status: 404 })
        }

        return NextResponse.json({ success: true, message: "Utilisateur supprimé" })
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ success: false, message: error.message || "Erreur serveur" }, { status: 500 })
    }
}
