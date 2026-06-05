/**
 * SchoolAdminManagementService
 *
 * Gestion des administrateurs d'ecole par les admins plateforme/ecole :
 * - Creer un compte SCHOOL_ADMIN + le rattacher a une ecole
 * - Generer un lien d'invitation pour le role SCHOOL_ADMIN
 * - Lister les admins d'une ecole
 *
 * Le mot de passe temporaire est genere et envoye par email.
 * L'admin ecole se connecte avec son email + mot de passe temporaire.
 */

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import School from '@/models/School'
import Invitation from '@/models/Invitation'
import { UserRole } from '@/models/enums'
import { sendEmail } from '@/lib/mail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateSchoolAdminInput {
    name: string
    email: string
    schoolId: string
    createdBy: string
}

export interface SchoolAdminResult {
    user: { _id: string; name: string; email: string; role: string }
    school: { _id: string; name: string }
    tempPassword: string
}

// ── Service ─────────────────────────────────────────────────────────────────

export class SchoolAdminManagementService {
    /**
     * Creer un compte SCHOOL_ADMIN et le rattacher a une ecole.
     * Genere un mot de passe temporaire et envoie un email d'activation.
     */
    static async createSchoolAdmin(input: CreateSchoolAdminInput): Promise<SchoolAdminResult> {
        await connectDB()

        const { name, email, schoolId, createdBy } = input
        const normalizedEmail = email.toLowerCase().trim()

        // 1. Verifier que l'ecole existe
        const school = await School.findById(schoolId).select('name admins').lean()
        if (!school) throw new Error("Etablissement introuvable")

        // 2. Verifier que l'email n'est pas deja utilise
        const existingUser = await User.findOne({ email: normalizedEmail }).lean()
        if (existingUser) throw new Error("Un compte avec cet email existe deja")

        // 3. Generer un mot de passe temporaire
        const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase()
        const hashedPassword = await bcrypt.hash(tempPassword, 12)

        // 4. Creer l'utilisateur avec le role SCHOOL_ADMIN
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: UserRole.SCHOOL_ADMIN,
            schools: [schoolId],
            isActive: true,
            emailVerified: true,
            preferences: {
                language: 'fr',
                notifications: { email: true, push: true },
            },
        })

        // 5. Ajouter l'admin dans le tableau admins de l'ecole
        await School.findByIdAndUpdate(schoolId, {
            $addToSet: { admins: user._id },
        })

        // 6. Envoyer l'email d'activation
        await SchoolAdminManagementService.sendSchoolAdminWelcomeEmail({
            email: normalizedEmail,
            name: name.trim(),
            schoolName: school.name,
            tempPassword,
        })

        return {
            user: {
                _id: user._id.toString(),
                name: user.name,
                email: user.email!,
                role: user.role,
            },
            school: {
                _id: schoolId,
                name: school.name,
            },
            tempPassword,
        }
    }

    /**
     * Generer un lien d'invitation pour le role SCHOOL_ADMIN.
     * Reutilise InvitationService.getOrCreateSchoolLink mais avec role SCHOOL_ADMIN.
     */
    static async getOrCreateInvitationLink(
        schoolId: string,
        createdBy: string,
    ): Promise<{ link: string; token: string; expiresAt: Date }> {
        await connectDB()

        const school = await School.findById(schoolId).select('name').lean()
        if (!school) throw new Error("Etablissement introuvable")

        // Chercher un lien actif existant
        const existing = await Invitation.findOne({
            schoolId,
            type: 'LINK',
            status: 'PENDING',
            role: UserRole.SCHOOL_ADMIN,
            $or: [
                { expiresAt: { $gt: new Date() } },
                { expiresAt: { $exists: false } },
            ],
        })

        if (existing) {
            return {
                link: `${APP_URL}/join?token=${existing.token}&role=SCHOOL_ADMIN`,
                token: existing.token,
                expiresAt: existing.expiresAt!,
            }
        }

        // Creer un nouveau lien
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours

        await Invitation.create({
            token,
            schoolId,
            type: 'LINK',
            status: 'PENDING',
            role: UserRole.SCHOOL_ADMIN,
            createdBy,
            expiresAt,
            currentUses: 0,
            registeredStudents: [],
        })

        return {
            link: `${APP_URL}/join?token=${token}&role=SCHOOL_ADMIN`,
            token,
            expiresAt,
        }
    }

    /**
     * Lister les admins d'une ecole.
     */
    static async listSchoolAdmins(schoolId: string) {
        await connectDB()

        const school = await School.findById(schoolId)
            .select('name admins owner')
            .populate('admins', 'name email role isActive createdAt')
            .populate('owner', 'name email')
            .lean()

        if (!school) throw new Error("Etablissement introuvable")

        return {
            school: { _id: school._id.toString(), name: school.name },
            owner: school.owner,
            admins: school.admins ?? [],
        }
    }

    /**
     * Email de bienvenue pour le nouvel admin ecole.
     */
    private static async sendSchoolAdminWelcomeEmail(params: {
        email: string
        name: string
        schoolName: string
        tempPassword: string
    }) {
        const { email, name, schoolName, tempPassword } = params
        const loginUrl = `${APP_URL}/login`

        const html = `
        <div style="font-family: 'Inter', 'Segoe UI', Roboto, sans-serif; background-color: #F3F4F6; margin: 0; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); overflow: hidden;">
                <div style="background: linear-gradient(135deg, #10B981, #7C3AED); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">Bienvenue sur Xkorienta</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Administrateur de ${schoolName}</p>
                </div>
                <div style="padding: 32px 30px; color: #1F2937; font-size: 15px; line-height: 1.7;">
                    <p>Bonjour <strong>${name}</strong>,</p>
                    <p>Votre compte administrateur a ete cree pour l'etablissement <strong>${schoolName}</strong>.</p>

                    <div style="background: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 16px; padding: 20px; margin: 20px 0;">
                        <p style="color: #10B981; font-weight: 600; font-size: 13px; text-transform: uppercase; margin: 0 0 12px;">Vos identifiants de connexion</p>
                        <p style="margin: 4px 0; font-size: 14px;"><strong>Email :</strong> ${email}</p>
                        <p style="margin: 4px 0; font-size: 14px;"><strong>Mot de passe temporaire :</strong></p>
                        <div style="font-family: monospace; font-size: 24px; letter-spacing: 2px; color: #7C3AED; background: white; padding: 12px; border-radius: 8px; text-align: center; margin-top: 8px; border: 2px dashed #7C3AED;">
                            ${tempPassword}
                        </div>
                        <p style="font-size: 12px; color: #D97706; margin-top: 12px; text-align: center;">
                            Modifiez ce mot de passe lors de votre premiere connexion.
                        </p>
                    </div>

                    <p>En tant qu'administrateur, vous pouvez :</p>
                    <ul style="padding-left: 20px; margin: 12px 0;">
                        <li>Gerer les inscriptions de votre etablissement</li>
                        <li>Valider les enseignants et les classes</li>
                        <li>Suivre les candidatures et les factures</li>
                    </ul>

                    <div style="text-align: center; margin: 24px 0;">
                        <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10B981, #7C3AED); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
                            Se connecter
                        </a>
                    </div>
                </div>
                <div style="background: #F8FAFC; padding: 24px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                    <p style="color: #6B7280; font-size: 12px; margin: 0;">Xkorienta — Plateforme d'orientation scolaire au Cameroun</p>
                </div>
            </div>
        </div>`

        await sendEmail({
            to: email,
            subject: `Votre compte administrateur — ${schoolName}`,
            html,
        })
    }
}
