import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Class from "@/models/Class"
import Syllabus from "@/models/Syllabus"
import { UserRole } from "@/models/enums"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id || session.user.role !== UserRole.STUDENT) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        await connectDB()

        // Find all classes where the student is enrolled
        const classes = await Class.find({
            students: session.user.id,
            isActive: true
        })
            .select('_id')
            .lean()

        if (!classes || classes.length === 0) {
            return NextResponse.json({
                success: true,
                data: []
            })
        }

        const classIds = classes.map(c => c._id)

        // Find all syllabuses assigned to the student's classes
        const syllabuses = await Syllabus.find({
            classes: { $in: classIds },
            status: { $ne: 'ARCHIVED' }
        })
            .populate('subject', 'name code')
            .populate('teacher', 'name')
            .populate('school', 'name')
            .select('-__v')
            .sort({ updatedAt: -1 })
            .lean()

        return NextResponse.json({
            success: true,
            data: syllabuses
        })

    } catch (error: any) {
        console.error("[Student Syllabuses] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
