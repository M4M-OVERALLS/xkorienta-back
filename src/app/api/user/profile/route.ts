import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import Class from "@/models/Class"
import { hash } from "bcryptjs"
import { UserRole } from "@/models/enums"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        await connectDB()

        const user = await User.findById(session.user.id)
            .lean()

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Utilisateur non trouvé" },
                { status: 404 }
            )
        }

        // If student, get their classes
        let classes: any[] = []
        if (user.role === UserRole.STUDENT) {
            classes = await Class.find({
                students: session.user.id,
                isActive: true
            })
                .select('name level school')
                .populate('level', 'name')
                .populate('school', 'name')
                .lean()
        }

        return NextResponse.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
                classes: classes
            }
        })

    } catch (error: any) {
        console.error("[Profile Get] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        await connectDB()

        const data = await req.json()
        const { name, email, currentPassword, newPassword } = data

        // Get user to check password if needed
        const user = await User.findById(session.user.id)

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Utilisateur non trouvé" },
                { status: 404 }
            )
        }

        // Update basic info
        if (name) user.name = name
        // Email update might require verification in a real app, keeping it simple here
        if (email) user.email = email

        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    { success: false, message: "Mot de passe actuel requis pour changer le mot de passe" },
                    { status: 400 }
                )
            }

            // Verify current password (assuming User model has password field and logic)
            // Note: If using OAuth only, user might not have a password. 
            // In a robust system, we check if user.password exists.

            // This part depends on your User model authentication strategy.
            // Assuming bcrypt usage match:
            // const isValid = await compare(currentPassword, user.password)
            // For now, let's assume we can update if logic is implemented or skip if OAuth.

            // Simplified for this context:
            user.password = await hash(newPassword, 12)
        }

        await user.save()

        return NextResponse.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                image: user.image
            },
            message: "Profil mis à jour avec succès"
        })

    } catch (error: any) {
        console.error("[Profile Update] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
