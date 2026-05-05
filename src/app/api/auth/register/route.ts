import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { registrationLimiter, getClientIdentifier, createRateLimitResponse } from '@/lib/security/rateLimiter'
import { RegistrationService } from '@/lib/services/RegistrationService'
import { sanitizeString, sanitizeEmail } from '@/lib/security/sanitize'
import { z } from 'zod'

const registrationService = new RegistrationService()

/**
 * POST /api/auth/register
 *
 * Inscription autonome de l'apprenant avec support des écoles non répertoriées.
 *
 * Payload:
 * {
 *   name: string
 *   email?: string
 *   phone?: string
 *   password: string
 *   role: UserRole
 *
 *   // Option 1 : École validée sélectionnée
 *   schoolId?: string
 *
 *   // Option 2 : École non répertoriée déclarée par l'apprenant
 *   declaredSchoolData?: {
 *     name: string
 *     city?: string
 *     country?: string
 *     type?: string
 *   }
 *
 *   // Option 3 : Sans école
 *   skipSchool?: boolean
 *
 *   levelId?: string
 *   fieldId?: string
 * }
 */
export async function POST(req: Request) {
    // Rate limiting
    const identifier = getClientIdentifier(req)
    const rateLimitResult = registrationLimiter(identifier)

    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime)
    }

    await connectDB()

    try {
        const body = await req.json()

        // ── Sanitisation des entrées de base ──────────────────────────────
        const sanitizedBody: any = {
            name: sanitizeString(body.name),
            password: body.password,
            role: body.role,
        }
        if (body.email) sanitizedBody.email = sanitizeEmail(body.email)
        if (body.phone) sanitizedBody.phone = body.phone?.trim()
        if (body.schoolId) sanitizedBody.schoolId = body.schoolId
        if (body.levelId) sanitizedBody.levelId = body.levelId
        if (body.fieldId) sanitizedBody.fieldId = body.fieldId
        if (typeof body.skipSchool === 'boolean') sanitizedBody.skipSchool = body.skipSchool

        // ── Sanitisation des données d'école déclarée ─────────────────────
        if (body.declaredSchoolData) {
            const dsd = body.declaredSchoolData

            // Détecter injection NoSQL
            if (typeof dsd.name !== 'string') {
                return NextResponse.json(
                    { error: 'Caractères invalides détectés' },
                    { status: 400 }
                )
            }

            // Détecter HTML/script
            if (/<[^>]*>/.test(dsd.name)) {
                return NextResponse.json(
                    { error: 'Caractères invalides détectés' },
                    { status: 400 }
                )
            }

            // Vérifier longueur
            if (dsd.name.length > 200) {
                return NextResponse.json(
                    { error: "Le nom de l'école ne peut pas dépasser 200 caractères" },
                    { status: 400 }
                )
            }

            // Détecter injection SQL-like
            if (/['";].*[-]{2}/.test(dsd.name)) {
                return NextResponse.json(
                    { error: 'Caractères invalides détectés' },
                    { status: 400 }
                )
            }

            sanitizedBody.declaredSchoolData = {
                name: dsd.name,
                city: typeof dsd.city === 'string' ? dsd.city : undefined,
                country: typeof dsd.country === 'string' ? dsd.country : undefined,
                type: typeof dsd.type === 'string' ? dsd.type : undefined,
            }
        }

        // ── Validation Zod ────────────────────────────────────────────────
        const registerSchema = z.object({
            name: z.string().min(2).max(100),
            email: z.string().email().optional(),
            phone: z
                .string()
                .min(8)
                .max(15)
                .regex(/^\+?[0-9]+$/, 'Numéro de téléphone invalide')
                .optional(),
            password: z.string().min(6).max(128),
            role: z.enum(['STUDENT', 'TEACHER', 'SCHOOL_ADMIN']),
            schoolId: z.string().optional(),
            declaredSchoolData: z
                .object({
                    name: z.string().min(2).max(200),
                    city: z.string().max(100).optional(),
                    country: z.string().max(100).optional(),
                    type: z.string().max(50).optional(),
                })
                .optional(),
            skipSchool: z.boolean().optional(),
            levelId: z.string().optional(),
            fieldId: z.string().optional(),
        }).refine(data => data.email || data.phone, {
            message: 'Email ou numéro de téléphone requis',
        })

        const parsed = registerSchema.parse(sanitizedBody)

        // ── Délégation au Service ─────────────────────────────────────────
        const result = await registrationService.registerUser(parsed)

        // ── Réponse ───────────────────────────────────────────────────────
        const response: any = {
            success: true,
            user: {
                id: result._id,
                name: result.name,
                email: result.email,
                role: result.role,
                hasUnverifiedSchool: !!result.unverifiedSchool,
                awaitingSchoolValidation: result.awaitingSchoolValidation ?? false,
            }
        }

        if (result.createdSchool) {
            response.createdSchool = {
                id: result.createdSchool._id,
                name: result.createdSchool.name,
                status: result.createdSchool.status,
            }
        }

        return NextResponse.json(response, { status: 201 })

    } catch (error: any) {
        console.error('[Auth Register] Error:', error)

        if (error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Données invalides', details: error.errors },
                { status: 400 }
            )
        }

        // Erreurs métier connues
        const knownConflicts = [
            'Un compte existe déjà avec cet email',
            'Ce numéro de téléphone est déjà utilisé',
            'User already exists',
        ]
        if (knownConflicts.some(msg => error.message?.includes(msg))) {
            return NextResponse.json(
                { error: error.message },
                { status: 409 }
            )
        }

        const knownBadRequests = [
            "Le nom de l'école ne peut pas dépasser 200 caractères",
            'Caractères invalides détectés',
            'Email ou numéro de téléphone requis',
            "L'email est requis pour ce type de compte",
            'Invalid role',
        ]
        if (knownBadRequests.some(msg => error.message?.includes(msg))) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Erreur interne du serveur' },
            { status: 500 }
        )
    }
}
