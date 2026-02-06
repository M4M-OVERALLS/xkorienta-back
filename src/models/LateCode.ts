import mongoose, { Schema, Document, Model } from 'mongoose'
import crypto from 'crypto'

/**
 * Statut d'un code de retard
 */
export enum LateCodeStatus {
    ACTIVE = 'ACTIVE',       // Code actif et utilisable
    USED = 'USED',           // Toutes les utilisations épuisées
    EXPIRED = 'EXPIRED',     // Code expiré
    REVOKED = 'REVOKED'      // Code révoqué par un administrateur
}

/**
 * Interface pour tracker l'utilisation d'un code
 */
export interface LateCodeUsage {
    userId: mongoose.Types.ObjectId
    usedAt: Date
    attemptId: mongoose.Types.ObjectId
}

/**
 * Modèle LateCode - Permet aux étudiants de soumettre après la deadline
 *
 * Cas d'usage:
 * - Étudiant en retard avec excuse valide
 * - Problème technique pendant l'examen
 * - Extension de temps pour raisons médicales
 *
 * @example
 * ```typescript
 * // Générer un code pour un examen
 * const lateCode = await LateCode.create({
 *   examId: exam._id,
 *   generatedBy: teacher._id,
 *   usagesRemaining: 1,
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
 * })
 *
 * console.log(lateCode.code) // "LATE-ABC123XYZ"
 *
 * // Valider et utiliser le code
 * const valid = await lateCode.isValid()
 * if (valid) {
 *   await lateCode.use(studentId, attemptId)
 * }
 * ```
 */
export interface ILateCode extends Document {
    _id: mongoose.Types.ObjectId
    examId: mongoose.Types.ObjectId

    // Code
    code: string // Format: "LATE-XXXXXXXX" (généré automatiquement)
    status: LateCodeStatus

    // Gestion des utilisations
    usagesRemaining: number // Nombre d'utilisations restantes (0 = illimité)
    maxUsages: number // Maximum d'utilisations autorisées
    usageHistory: LateCodeUsage[] // Historique des utilisations

    // Temporalité
    expiresAt: Date // Date d'expiration du code
    generatedAt: Date
    revokedAt?: Date

    // Métadonnées
    generatedBy: mongoose.Types.ObjectId // Teacher/Admin qui a généré le code
    revokedBy?: mongoose.Types.ObjectId // Teacher/Admin qui a révoqué le code
    reason?: string // Raison de la génération du code
    notes?: string // Notes additionnelles

    assignedUserId?: mongoose.Types.ObjectId // User specific assignment

    createdAt: Date
    updatedAt: Date

    // Méthodes
    isValid(): Promise<boolean>
    use(userId: mongoose.Types.ObjectId, attemptId: mongoose.Types.ObjectId): Promise<void>
    revoke(adminId: mongoose.Types.ObjectId): Promise<void>
}

const LateCodeSchema = new Schema<ILateCode>(
    {
        examId: {
            type: Schema.Types.ObjectId,
            ref: 'Exam',
            required: true,
            index: true
        },

        // Code
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true
            // Note: unique:true already creates an index
        },
        status: {
            type: String,
            enum: Object.values(LateCodeStatus),
            default: LateCodeStatus.ACTIVE,
            index: true
        },

        // Gestion des utilisations
        usagesRemaining: {
            type: Number,
            default: 1,
            min: 0
        },
        maxUsages: {
            type: Number,
            default: 1,
            min: 0
        },
        usageHistory: [
            {
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },
                usedAt: {
                    type: Date,
                    required: true
                },
                attemptId: {
                    type: Schema.Types.ObjectId,
                    ref: 'Attempt',
                    required: true
                }
            }
        ],

        // Temporalité
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },
        generatedAt: {
            type: Date,
            default: Date.now
        },
        revokedAt: {
            type: Date
        },

        // Métadonnées
        generatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: {
            type: String,
            trim: true
        },
        notes: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
)

// Générer automatiquement un code unique avant la sauvegarde
LateCodeSchema.pre('save', async function () {
    if (!this.code) {
        // Générer un code unique: LATE-XXXXXXXX (8 caractères alphanumériques)
        const randomString = crypto.randomBytes(4).toString('hex').toUpperCase()
        this.code = `LATE-${randomString}`
    }

    // Synchroniser usagesRemaining avec usageHistory
    if (this.maxUsages > 0) {
        this.usagesRemaining = Math.max(0, this.maxUsages - this.usageHistory.length)

        // Marquer comme USED si plus d'utilisations
        if (this.usagesRemaining === 0 && this.status === LateCodeStatus.ACTIVE) {
            this.status = LateCodeStatus.USED
        }
    }
})

/**
 * Valide si le code peut être utilisé
 */
LateCodeSchema.methods.isValid = async function (): Promise<boolean> {
    // Vérifier le statut
    if (this.status !== LateCodeStatus.ACTIVE) {
        return false
    }

    // Vérifier l'expiration
    if (new Date() > this.expiresAt) {
        this.status = LateCodeStatus.EXPIRED
        await this.save()
        return false
    }

    // Vérifier les utilisations restantes (0 = illimité)
    if (this.maxUsages > 0 && this.usagesRemaining <= 0) {
        return false
    }

    return true
}

/**
 * Utilise le code pour un étudiant
 */
LateCodeSchema.methods.use = async function (
    userId: mongoose.Types.ObjectId,
    attemptId: mongoose.Types.ObjectId
): Promise<void> {
    // Valider avant utilisation
    const valid = await this.isValid()
    if (!valid) {
        throw new Error('Late code is not valid or has expired')
    }

    // Vérifier si l'utilisateur a déjà utilisé ce code
    const alreadyUsed = this.usageHistory.some(
        (usage: LateCodeUsage) => usage.userId.toString() === userId.toString()
    )

    if (alreadyUsed) {
        throw new Error('This code has already been used by this user')
    }

    // Ajouter à l'historique
    this.usageHistory.push({
        userId,
        usedAt: new Date(),
        attemptId
    })

    // Sauvegarder (le hook pre-save mettra à jour usagesRemaining)
    await this.save()
}

/**
 * Révoquer le code
 */
LateCodeSchema.methods.revoke = async function (
    adminId: mongoose.Types.ObjectId
): Promise<void> {
    this.status = LateCodeStatus.REVOKED
    this.revokedBy = adminId
    this.revokedAt = new Date()
    await this.save()
}

// Indexes pour optimisation
LateCodeSchema.index({ examId: 1, status: 1 }) // Trouver les codes actifs pour un examen
LateCodeSchema.index({ generatedBy: 1 }) // Codes générés par un teacher
LateCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 }) // TTL: supprime après 30 jours d'expiration

const LateCode: Model<ILateCode> = mongoose.models.LateCode || mongoose.model<ILateCode>('LateCode', LateCodeSchema)

export default LateCode
