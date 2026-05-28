import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { UserRole } from "@/models/enums"

const ADMIN_ROLES = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * GET /api/admin/users
 * List users in the admin's school (teachers + students).
 * For platform admins (DG_M4M / TECH_SUPPORT): returns all users.
 * Query params: ?role=TEACHER|STUDENT|...  ?search=string  ?page=1  ?limit=50
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: "Accès réservé aux administrateurs" }, { status: 403 })
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const roleFilter = searchParams.get("role")
        const search = searchParams.get("search") || ""
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
        const skip = (page - 1) * limit

        const isPlatformAdmin = [UserRole.DG_M4M, UserRole.TECH_SUPPORT].includes(session.user.role as UserRole)

        // Build query
        const query: Record<string, unknown> = {}

        if (!isPlatformAdmin) {
            // School admin: only see users in their school
            const admin = await User.findById(session.user.id).select("schools").lean()
            const schoolIds = (admin as any)?.schools ?? []
            if (schoolIds.length === 0) {
                return NextResponse.json({ success: true, data: { users: [], total: 0 } })
            }
            query.schools = { $in: schoolIds }
        }

        if (roleFilter) query.role = roleFilter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ]
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select("name email role isActive createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query),
        ])

        return NextResponse.json({
            success: true,
            data: { users, total, page, limit },
        })
    } catch (error: any) {
        console.error("[Admin Users GET]", error)
        return NextResponse.json({ success: false, message: error.message || "Erreur serveur" }, { status: 500 })
    }
}
