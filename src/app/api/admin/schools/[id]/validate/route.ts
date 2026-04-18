import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { SchoolService } from "@/lib/services/SchoolService"
import { UserRole } from "@/models/enums"

/** Roles allowed to validate / reject / suspend schools on the platform */
const PLATFORM_ADMIN_ROLES = [
    UserRole.RECTOR,
    UserRole.DG_M4M,
    UserRole.TECH_SUPPORT,
    UserRole.DG_ISIMMA,
]

/**
 * POST /api/admin/schools/[id]/validate
 *
 * Body: { action: 'VALIDATE' | 'REJECT' | 'SUSPEND', notes?: string }
 *
 * - VALIDATE : marks the school as officially verified (PENDING → VALIDATED)
 * - REJECT   : marks as rejected with mandatory notes (PENDING → REJECTED)
 * - SUSPEND  : suspends a previously validated school (VALIDATED → SUSPENDED)
 *
 * Access: platform admins only (RECTOR, DG_M4M, TECH_SUPPORT, DG_ISIMMA)
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }

        if (!PLATFORM_ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json(
                { success: false, message: "Accès réservé aux administrateurs de la plateforme" },
                { status: 403 }
            )
        }

        if (!id || id === 'undefined') {
            return NextResponse.json({ success: false, message: "ID d'école invalide" }, { status: 400 })
        }

        const body = await req.json()
        const { action, notes } = body as { action?: string; notes?: string }

        if (!action || !['VALIDATE', 'REJECT', 'SUSPEND'].includes(action)) {
            return NextResponse.json(
                { success: false, message: "Action invalide. Valeurs acceptées: VALIDATE, REJECT, SUSPEND" },
                { status: 400 }
            )
        }

        await connectDB()

        let school
        switch (action) {
            case 'VALIDATE':
                school = await SchoolService.validateSchool(id, session.user.id)
                return NextResponse.json({
                    success: true,
                    message: "École validée avec succès",
                    school: { _id: school._id, name: school.name, status: school.status }
                })

            case 'REJECT':
                if (!notes?.trim()) {
                    return NextResponse.json(
                        { success: false, message: "Une raison de rejet est obligatoire (champ notes)" },
                        { status: 400 }
                    )
                }
                school = await SchoolService.rejectSchool(id, session.user.id, notes)
                return NextResponse.json({
                    success: true,
                    message: "École rejetée",
                    school: { _id: school._id, name: school.name, status: school.status }
                })

            case 'SUSPEND':
                if (!notes?.trim()) {
                    return NextResponse.json(
                        { success: false, message: "Une raison de suspension est obligatoire (champ notes)" },
                        { status: 400 }
                    )
                }
                school = await SchoolService.suspendSchool(id, session.user.id, notes)
                return NextResponse.json({
                    success: true,
                    message: "École suspendue",
                    school: { _id: school._id, name: school.name, status: school.status }
                })
        }

    } catch (error: any) {
        console.error("[Admin Schools Validate] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: error.message?.includes("not found") ? 404 : 500 }
        )
    }
}
