import mongoose, { Schema, Document, Model } from 'mongoose'
import {
    CognitiveProfile,
    LearnerType,
    SubscriptionStatus,
    LearningMode
} from './enums'

export interface ILearnerProfile extends Document {
    _id: mongoose.Types.ObjectId
    user: mongoose.Types.ObjectId // Ref: 'User'

    // Parcours Académique
    /**
     * Niveau actuel (EducationLevel).
     *
     * NOTE: L'onboarding "student" peut être incomplet / en cours.
     * On garde donc ce champ non-bloquant pour éviter de bloquer la connexion
     * (erreur 500) si la résolution du niveau échoue ou n'est pas fournie.
     */
    currentLevel?: mongoose.Types.ObjectId // Ref: 'EducationLevel'
    currentField?: mongoose.Types.ObjectId // Ref: 'Field'
    enrollmentDate: Date
    expectedGraduationDate?: Date

    // Flag pour école en attente de validation
    awaitingSchoolValidation: boolean

    // Profil Cognitif
    cognitiveProfile?: CognitiveProfile
    learnerType?: LearnerType

    // Abonnement
    subscriptionStatus: SubscriptionStatus
    subscriptionExpiry?: Date

    // Préférences d'Apprentissage
    preferredLearningMode?: LearningMode

    // Statistiques (dénormalisées)
    stats: {
        totalExamsTaken: number
        averageScore: number
        totalStudyTime: number
        strongSubjects: mongoose.Types.ObjectId[] // Ref: 'Subject'
        weakSubjects: mongoose.Types.ObjectId[] // Ref: 'Subject'
        lastActivityDate?: Date
    }

    // Gamification
    gamification: {
        level: number
        xp: number
        badges: {
            badgeId: string
            earnedAt: Date
        }[]
        streak: number
    }

    createdAt: Date
    updatedAt: Date
}

const LearnerProfileSchema = new Schema<ILearnerProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },
        currentLevel: {
            type: Schema.Types.ObjectId,
            ref: 'EducationLevel',
            required: false // IMPORTANT: L'onboarding "student" peut être incomplet / en cours.
        },
        currentField: {
            type: Schema.Types.ObjectId,
            ref: 'Field'
        },
        enrollmentDate: {
            type: Date,
            default: Date.now
        },
        expectedGraduationDate: Date,

        awaitingSchoolValidation: { type: Boolean, default: false },

        cognitiveProfile: {
            type: String,
            enum: Object.values(CognitiveProfile)
        },
        learnerType: {
            type: String,
            enum: Object.values(LearnerType)
        },

        subscriptionStatus: {
            type: String,
            enum: Object.values(SubscriptionStatus),
            default: SubscriptionStatus.FREEMIUM
        },
        subscriptionExpiry: Date,

        preferredLearningMode: {
            type: String,
            enum: Object.values(LearningMode)
        },

        stats: {
            totalExamsTaken: { type: Number, default: 0 },
            averageScore: { type: Number, default: 0 },
            totalStudyTime: { type: Number, default: 0 },
            strongSubjects: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
            weakSubjects: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
            lastActivityDate: Date
        },

        gamification: {
            level: { type: Number, default: 1 },
            xp: { type: Number, default: 0 },
            badges: [{
                badgeId: String,
                earnedAt: { type: Date, default: Date.now }
            }],
            streak: { type: Number, default: 0 }
        }
    },
    {
        timestamps: true
    }
)

// Indexes
LearnerProfileSchema.index({ currentLevel: 1, currentField: 1 })
LearnerProfileSchema.index({ subscriptionStatus: 1 })

const LearnerProfile: Model<ILearnerProfile> = mongoose.models.LearnerProfile || mongoose.model<ILearnerProfile>('LearnerProfile', LearnerProfileSchema)

export default LearnerProfile
