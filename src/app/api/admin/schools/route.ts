import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { SchoolService } from "@/lib/services/SchoolService"
import { SchoolStatus, UserRole } from "@/models/enums"

const PLATFORM_ADMIN_ROLES = [
    UserRole.RECTOR,
    UserRole.DG_M4M,
    UserRole.TECH_SUPPORT,
    UserRole.DG_ISIMMA,
]

/**
 * GET /api/admin/schools
 *
 * List schools by status for the admin verification panel.
 *
 * Query params:
 *   ?status=PENDING|VALIDATED|REJECTED|SUSPENDED  (default: PENDING)
 *   &page=number    (default: 1)
 *   &limit=number   (default: 20)
 *   &search=string  (optional name filter)
 *
 * Access: platform admins only
 */
export async function GET(req: Request) {
    try {
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

        const { searchParams } = new URL(req.url)
        const statusParam = (searchParams.get("status") || "PENDING").toUpperCase()
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
        const search = searchParams.get("search") || undefined

        if (!Object.values(SchoolStatus).includes(statusParam as SchoolStatus)) {
            return NextResponse.json(
                { success: false, message: `Statut invalide. Valeurs: ${Object.values(SchoolStatus).join(", ")}` },
                { status: 400 }
            )
        }

        await connectDB()

        const { schools, total, totalPages } = await SchoolService.getSchoolsByStatus(
            statusParam as SchoolStatus,
            page,
            limit,
            search
        )

        return NextResponse.json({
            success: true,
            data: schools,
            pagination: { page, limit, total, totalPages }
        })

    } catch (error: any) {
        console.error("[Admin Schools GET] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
