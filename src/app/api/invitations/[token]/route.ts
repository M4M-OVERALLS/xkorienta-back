import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import { InvitationService } from "@/lib/services/InvitationService"
import User from "@/models/User"
import bcrypt from "bcryptjs"

/**
 * GET /api/invitations/[token]
 * Public endpoint to validate an invitation and get class info
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        await connectDB()

        const invitation = await InvitationService.getInvitationByToken(token)

        if (!invitation) {
            return NextResponse.json(
                { success: false, message: "Lien d'invitation invalide ou expiré" },
                { status: 404 }
            )
        }

        // Return safe public data
        const classInfo = invitation.classId as any

        // For INDIVIDUAL invitations, include email (pre-created account)
        const responseData: any = {
            type: invitation.type,
            className: classInfo?.name || 'Classe',
            schoolName: classInfo?.school?.name || 'École',
            teacherName: classInfo?.mainTeacher?.name || 'Enseignant',
            academicYear: classInfo?.academicYear,
            expiresAt: invitation.expiresAt,
            remainingUses: invitation.maxUses
                ? invitation.maxUses - invitation.currentUses
                : null
        }

        // If INDIVIDUAL, the account already exists - include email for activation flow
        if (invitation.type === 'INDIVIDUAL' && invitation.email) {
            // Verify the user still exists
            const existingUser = await User.findOne({ 
                email: { $regex: new RegExp(`^${invitation.email}$`, 'i') } 
            })
            
            if (existingUser) {
                responseData.email = invitation.email
                responseData.isActivation = true // Flag for frontend
            } else {
                // User was deleted, treat as new registration
                responseData.isActivation = false
                console.error(`[Invitation] User ${invitation.email} not found for INDIVIDUAL invitation`)
            }
        }

        return NextResponse.json({
            success: true,
            data: responseData
        })

    } catch (error: any) {
        console.error("Error validating invitation:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/invitations/[token]
 * Register a new user OR activate existing account via invitation
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const body = await req.json()
        const { password, name, email } = body

        if (!password || password.length < 8) {
            return NextResponse.json(
                { success: false, message: "Le mot de passe doit contenir au moins 8 caractères" },
                { status: 400 }
            )
        }

        await connectDB()

        const invitation = await InvitationService.getInvitationByToken(token)
        if (!invitation) {
            return NextResponse.json(
                { success: false, message: "Lien d'invitation invalide ou expiré" },
                { status: 404 }
            )
        }

        // INDIVIDUAL invitation - account already exists, just activate
        if (invitation.type === 'INDIVIDUAL' && invitation.email) {
            // Case-insensitive email search
            const existingUser = await User.findOne({ 
                email: { $regex: new RegExp(`^${invitation.email}$`, 'i') } 
            })

            if (!existingUser) {
                console.error(`[Invitation] User not found for email: ${invitation.email}`)
                return NextResponse.json(
                    { success: false, message: "Compte non trouvé" },
                    { status: 404 }
                )
            }

            console.log(`[Invitation] Activating account for user: ${existingUser.email}`)

            // Update password and activate account
            const hashedPassword = await bcrypt.hash(password, 10)
            existingUser.password = hashedPassword
            existingUser.isActive = true
            existingUser.emailVerified = true
            await existingUser.save()

            console.log(`[Invitation] Account activated, enrolling in class...`)

            // Accept invitation (enroll in class)
            await InvitationService.acceptInvitation(token, existingUser._id.toString())

            return NextResponse.json({
                success: true,
                message: "Compte activé avec succès ! Vous pouvez maintenant vous connecter.",
                data: {
                    userId: existingUser._id,
                    email: existingUser.email
                }
            })
        }

        // LINK invitation - need to create new account
        if (!name || name.length < 2) {
            return NextResponse.json(
                { success: false, message: "Le nom doit contenir au moins 2 caractères" },
                { status: 400 }
            )
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json(
                { success: false, message: "Email invalide" },
                { status: 400 }
            )
        }

        const result = await InvitationService.registerViaInvitation(token, {
            name,
            email,
            password
        })

        return NextResponse.json({
            success: true,
            message: "Compte créé avec succès ! Vous pouvez maintenant vous connecter.",
            data: {
                userId: result.user._id,
                email: result.user.email
            }
        })

    } catch (error: any) {
        console.error("Error registering via invitation:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: error.message?.includes("existe déjà") ? 409 : 500 }
        )
    }
}
