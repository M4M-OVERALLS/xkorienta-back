import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import { UserRole } from "@/models/enums"
import mongoose from "mongoose"

type HandlerFunction = (
    req: Request,
    context: { params: any; session: any; exam: any }
) => Promise<NextResponse>

/**
 * Admin roles that get scope-based access (same school / institution).
 * They don't bypass unconditionally — they must share a school with the exam creator.
 */
const ADMIN_ROLES: UserRole[] = [
    UserRole.INSPECTOR,
    UserRole.PRINCIPAL,
    UserRole.SCHOOL_ADMIN,
    UserRole.PREFET,
]

/** Platform-level roles that bypass all exam read checks. */
const PLATFORM_ROLES: UserRole[] = [
    UserRole.DG_ISIMMA,
    UserRole.RECTOR,
    UserRole.DG_M4M,
    UserRole.TECH_SUPPORT,
]

/**
 * Middleware A-12: requireExamRead
 *
 * Authorises read access to a single exam based on:
 *  1. Platform admins (DG, Rector, Tech) — unrestricted
 *  2. Exam creator — always allowed
 *  3. School admins / inspectors / principals — allowed if they share at least one school with the creator
 *  4. Published public-demo exams — allowed for any authenticated user
 *  5. All other cases — 403 Forbidden
 *
 * The middleware fetches the exam once and passes it to the handler so it
 * doesn't need to be re-queried.
 */
export function requireExamRead(handler: HandlerFunction) {
    return async (req: Request, { params }: { params: any }) => {
        try {
            const session = await getServerSession(authOptions)

            if (!session?.user?.id) {
                return NextResponse.json(
                    { success: false, message: "Non autorisé" },
                    { status: 401 }
                )
            }

            await connectDB()
            const resolvedParams = await params
            const examId = resolvedParams.id

            if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
                return NextResponse.json(
                    { success: false, message: "ID examen invalide" },
                    { status: 400 }
                )
            }

            const exam = await Exam.findById(examId)
                .populate("createdById", "_id schools")
                .lean()

            if (!exam) {
                return NextResponse.json(
                    { success: false, message: "Examen non trouvé" },
                    { status: 404 }
                )
            }

            const userId = session.user.id
            const userRole = session.user.role as UserRole
            const userSchools: string[] = (session.user.schools ?? []).map(String)

            // 1. Platform-level admins — unrestricted read
            if (PLATFORM_ROLES.includes(userRole)) {
                return handler(req, { params, session, exam })
            }

            // 2. Creator — always allowed
            // createdById is populated as { _id, schools } via .populate()
            const rawCreator = exam.createdById as unknown
            const isPopulated = typeof rawCreator === "object" && rawCreator !== null && "_id" in rawCreator
            const populated = rawCreator as { _id: mongoose.Types.ObjectId; schools?: mongoose.Types.ObjectId[] }
            const creatorId = isPopulated ? populated._id.toString() : String(rawCreator)

            if (creatorId === userId) {
                return handler(req, { params, session, exam })
            }

            // 3. School admin / inspector / principal — same school check
            if (ADMIN_ROLES.includes(userRole) && userSchools.length > 0) {
                const creatorSchools: string[] = (
                    isPopulated ? (populated.schools ?? []) : []
                ).map(String)

                const hasCommonSchool = userSchools.some(s => creatorSchools.includes(s))
                if (hasCommonSchool) {
                    return handler(req, { params, session, exam })
                }
            }

            // 4. Published public-demo exams — any authenticated user
            if (exam.isPublicDemo && exam.isPublished) {
                return handler(req, { params, session, exam })
            }

            // 5. Denied
            return NextResponse.json(
                { success: false, message: "Accès interdit à cet examen" },
                { status: 403 }
            )

        } catch (error) {
            console.error("[requireExamRead] Error:", error)
            return NextResponse.json(
                { success: false, message: "Erreur serveur" },
                { status: 500 }
            )
        }
    }
}
