import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { SchoolStatus, MediaStatus, MediaType, UserRole } from "@/models/enums"

const PLATFORM_ADMIN_ROLES = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * GET /api/admin/stats
 *
 * Returns platform-level statistics for the super-admin dashboard.
 *
 * Access: DG_M4M | TECH_SUPPORT only
 */
export async function GET() {
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

        await connectDB()

        const School = (await import("@/models/School")).default
        const User = (await import("@/models/User")).default
        const Media = (await import("@/models/Media")).default

        const [
            schoolsPending,
            schoolsValidated,
            schoolsRejected,
            schoolsSuspended,
            mediaPending,
            booksPending,
            usersTotal,
        ] = await Promise.all([
            School.countDocuments({ status: SchoolStatus.PENDING }),
            School.countDocuments({ status: SchoolStatus.VALIDATED }),
            School.countDocuments({ status: SchoolStatus.REJECTED }),
            School.countDocuments({ status: SchoolStatus.SUSPENDED }),
            Media.countDocuments({ status: MediaStatus.PENDING, mediaType: { $ne: MediaType.BOOK } }),
            Media.countDocuments({ status: MediaStatus.PENDING, mediaType: MediaType.BOOK }),
            User.countDocuments({ isActive: true }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                schools: {
                    pending: schoolsPending,
                    validated: schoolsValidated,
                    rejected: schoolsRejected,
                    suspended: schoolsSuspended,
                    total: schoolsPending + schoolsValidated + schoolsRejected + schoolsSuspended,
                },
                media: { pending: mediaPending },
                books: { pending: booksPending },
                users: { total: usersTotal },
            }
        })

    } catch (error: any) {
        console.error("[Admin Stats] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
