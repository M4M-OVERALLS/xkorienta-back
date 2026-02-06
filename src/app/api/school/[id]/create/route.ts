import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { SchoolController } from "@/lib/controllers/SchoolController"
import { UserRole } from "@/models/enums"

import "@/models/School"
import "@/models/SchoolProfile"
import "@/models/RegulatoryApproval"
import "@/models/SchoolScore"
import "@/models/InfrastructureMetric"
import "@/models/Partner"
import "@/models/City"
import "@/models/Department"
import "@/models/Region"
import "@/models/Country"
import "@/models/User"

type RouteContext = {
    params: { id: string }
}

/**
 * POST /api/school/[id]/create
 * Create a new school (Teacher only)
 */
export async function POST(req: Request, context: RouteContext) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non authentifié" },
                { status: 401 }
            )
        }

        if (session.user.role !== UserRole.TEACHER) {
            return NextResponse.json(
                { success: false, message: "Seuls les enseignants peuvent créer une école" },
                { status: 403 }
            )
        }

        const { id } = context.params
        if (!id || id !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Identifiant utilisateur invalide" },
                { status: 403 }
            )
        }

        await connectDB()

        return SchoolController.createSchool(req, session.user.id)
    } catch (error: unknown) {
        console.error("[School Create Route] Unexpected error:", error)
        const message = error instanceof Error ? error.message : "Erreur serveur inattendue"
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        )
    }
}
