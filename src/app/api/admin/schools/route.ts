import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { SchoolService } from "@/lib/services/SchoolService"
import { SchoolStatus, UserRole } from "@/models/enums"

const PLATFORM_ADMIN_ROLES = [
    UserRole.DG_M4M,
    UserRole.TECH_SUPPORT,
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

        if (statusParam !== "ALL" && !Object.values(SchoolStatus).includes(statusParam as SchoolStatus)) {
            return NextResponse.json(
                { success: false, message: `Statut invalide. Valeurs: ALL, ${Object.values(SchoolStatus).join(", ")}` },
                { status: 400 }
            )
        }

        await connectDB()

        const { schools, total, totalPages } = await SchoolService.getSchoolsByStatus(
            statusParam as SchoolStatus | "ALL",
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

/**
 * POST /api/admin/schools
 *
 * Create a school directly as platform admin (status VALIDATED immediately).
 *
 * Body: { name, type, address?, city?, country?, contactInfo? }
 *
 * Access: DG_M4M | TECH_SUPPORT only
 */
export async function POST(req: Request) {
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

        const body = await req.json()
        const { name, type, address, city, country, contactInfo } = body as {
            name?: string
            type?: string
            address?: string
            city?: string
            country?: string
            contactInfo?: { email?: string; phone?: string; website?: string }
        }

        if (!name?.trim()) {
            return NextResponse.json({ success: false, message: "Le nom de l'école est obligatoire" }, { status: 400 })
        }

        if (!type?.trim()) {
            return NextResponse.json({ success: false, message: "Le type d'école est obligatoire" }, { status: 400 })
        }

        await connectDB()

        const school = await SchoolService.createSchoolByAdmin({
            name: name.trim(),
            type,
            address,
            city,
            country,
            contactInfo,
            adminId: session.user.id,
        })

        return NextResponse.json({ success: true, data: school }, { status: 201 })

    } catch (error: any) {
        console.error("[Admin Schools POST] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
