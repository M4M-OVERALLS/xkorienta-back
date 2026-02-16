import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { UserRole } from "@/models/enums"

/**
 * GET /api/teachers/external
 * Search for external teachers (from other schools)
 * Used for finding teachers for paid assistance requests
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const subjectId = searchParams.get("subject")
        const schoolId = searchParams.get("school")
        const limit = parseInt(searchParams.get("limit") || "20")

        // Get the student's school to exclude it from results
        const student = await User.findById(session.user.id)
        if (!student) {
            return NextResponse.json(
                { success: false, error: "Étudiant non trouvé" },
                { status: 404 }
            )
        }

        const studentSchoolId = student.schools?.[0]?.toString()

        // Build query for external teachers
        const query: any = {
            role: UserRole.TEACHER,
            isActive: true
        }

        // Exclude student's own school if they have one
        if (studentSchoolId) {
            query.schools = { $nin: [studentSchoolId] }
        }

        // Filter by specific school if requested
        if (schoolId) {
            query.schools = { ...query.schools, $in: [schoolId] }
        }

        // Filter by subject if requested
        if (subjectId) {
            query.subjects = subjectId
        }

        const teachers = await User.find(query)
            .select("_id name email image schools subjects isActive")
            .populate("schools", "name city")
            .populate("subjects", "name")
            .sort({ name: 1 })
            .limit(limit)

        return NextResponse.json({
            success: true,
            data: teachers
        })
    } catch (error) {
        console.error("Error fetching external teachers:", error)
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        )
    }
}
