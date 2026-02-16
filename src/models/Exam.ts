import mongoose, { Schema, Document, Model } from 'mongoose'
import {
    SubSystem,
    DifficultyLevel,
    PedagogicalObjective,
    EvaluationType,
    ExamStatus,
    LearningMode,
    CloseMode
} from './enums'

/**
 * Interface pour les statistiques d'un examen
 */
export interface ExamStats {
    totalAttempts: number
    totalCompletions: number // NOUVEAU - Renommé de completedAttempts
    averageScore: number
    averageTime: number // NOUVEAU - Renommé de averageTimeSpent
    passRate: number // Pourcentage de réussite
    lastAttemptDate?: Date // NOUVEAU
}

/**
 * Interface pour la configuration anti-triche
 */
export interface AntiCheatConfig {
    fullscreenRequired: boolean // NOUVEAU - Renommé de enableFullscreen
    disableCopyPaste: boolean // NOUVEAU - Renommé de detectCopyPaste
    trackTabSwitches: boolean // NOUVEAU - Renommé de detectTabSwitch
    webcamRequired: boolean // NOUVEAU
    maxTabSwitches?: number // Nombre maximum de changements d'onglet autorisés
    preventScreenshot: boolean
    blockRightClick: boolean
    // AI Reformulation (Hugging Face)
    aiReformulation?: boolean // Reformuler les questions avec l'IA
    reformulationIntensity?: 'LIGHT' | 'MODERATE' | 'STRONG' // Intensité de la reformulation
}

/**
 * Interface pour la configuration de l'examen
 */
export interface ExamConfig {
    shuffleQuestions: boolean
    shuffleOptions: boolean
    showResultsImmediately: boolean
    allowReview: boolean // Permettre la révision après soumission
    passingScore: number // NOUVEAU - Pourcentage minimum
    maxAttempts: number // NOUVEAU
    timeBetweenAttempts: number // NOUVEAU - en heures
    enableImmediateFeedback: boolean // Feedback immédiat pour évaluations formatives
    antiCheat: AntiCheatConfig

    // Configuration Late Exam (retardataires)
    lateDuration?: number // Durée additionnelle en minutes pour les retardataires
    lateExamId?: mongoose.Types.ObjectId // Référence vers un examen alternatif pour retardataires
    delayResultsUntilLateEnd?: boolean // Ne pas afficher les résultats avant fin de la période late

    // Auto-évaluation des concepts
    enableSelfAssessment?: boolean // Activer l'auto-évaluation après l'examen
    enableGuidedReflection?: boolean // Activer la réflexion guidée
    requireConceptEvaluation?: boolean // Rendre l'auto-évaluation obligatoire
}

/**
 * Interface principale du modèle Exam V2
 */
export interface IExam extends Document {
    _id: mongoose.Types.ObjectId

    // Informations de base
    title: string
    description?: string
    imageUrl?: string

    // Classification éducative (NOUVEAUX CHAMPS V2)
    subSystem: SubSystem
    targetLevels: mongoose.Types.ObjectId[] // Références vers EducationLevel
    subject: mongoose.Types.ObjectId // Référence vers Subject
    syllabus?: mongoose.Types.ObjectId // Référence vers Syllabus (NOUVEAU)
    learningUnit?: mongoose.Types.ObjectId // Référence vers LearningUnit (optionnel)
    targetFields?: mongoose.Types.ObjectId[] // Références vers Field (Séries/Filières)
    targetedCompetencies?: mongoose.Types.ObjectId[] // Références vers Competency
    linkedConcepts?: mongoose.Types.ObjectId[] // Références vers Concept (pour évaluations par concept)

    // Objectifs pédagogiques (NOUVEAUX CHAMPS V2)
    pedagogicalObjective: PedagogicalObjective
    evaluationType: EvaluationType
    learningMode: LearningMode // NOUVEAU
    difficultyLevel: DifficultyLevel

    // Configuration temporelle
    startTime: Date
    endTime: Date
    duration: number // Durée en minutes
    closeMode: CloseMode

    // Statut et publication (NOUVEAUX CHAMPS V2)
    status: ExamStatus // DRAFT, PENDING_VALIDATION, VALIDATED, PUBLISHED, ARCHIVED
    isPublished: boolean
    isActive: boolean // NOUVEAU
    publishedAt?: Date
    validatedBy?: mongoose.Types.ObjectId // Référence vers User (Inspector)
    validatedAt?: Date

    // Configuration (NOUVEAUX CHAMPS V2)
    config: ExamConfig

    // Statistiques (NOUVEAUX CHAMPS V2 - denormalized pour performance)
    stats: ExamStats

    // Métadonnées
    createdById: mongoose.Types.ObjectId
    tags: string[] // NOUVEAU
    version: number // Version du document (pour optimistic locking)
    previousVersions: mongoose.Types.ObjectId[] // NOUVEAU - Refs vers anciennes versions
    createdAt: Date
    updatedAt: Date

    // Méthode pour calculer le score total
    getTotalPoints(): Promise<number>
}

const ExamSchema = new Schema<IExam>(
    {
        // Informations de base
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        imageUrl: {
            type: String
        },

        // Classification éducative
        subSystem: {
            type: String,
            enum: Object.values(SubSystem),
            required: true
        },
        targetLevels: [
            {
                type: Schema.Types.ObjectId,
                ref: 'EducationLevel',
                required: true
            }
        ],
        subject: {
            type: Schema.Types.ObjectId,
            ref: 'Subject',
            required: true
        },
        syllabus: {
            type: Schema.Types.ObjectId,
            ref: 'Syllabus'
        },
        learningUnit: {
            type: Schema.Types.ObjectId,
            ref: 'LearningUnit'
        },
        targetFields: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Field'
            }
        ],
        targetedCompetencies: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Competency'
            }
        ],
        // Concepts liés (pour évaluations basées sur concepts)
        linkedConcepts: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Concept'
            }
        ],

        // Objectifs pédagogiques
        pedagogicalObjective: {
            type: String,
            enum: Object.values(PedagogicalObjective),
            required: true
        },
        evaluationType: {
            type: String,
            enum: Object.values(EvaluationType),
            required: true
        },
        learningMode: {
            type: String,
            enum: Object.values(LearningMode),
            required: true
        },
        difficultyLevel: {
            type: String,
            enum: Object.values(DifficultyLevel),
            required: true
        },

        // Configuration temporelle
        startTime: {
            type: Date,
            required: true
        },
        endTime: {
            type: Date,
            required: true
        },
        duration: {
            type: Number,
            required: true,
            min: 1
        },
        closeMode: {
            type: String,
            enum: Object.values(CloseMode),
            default: CloseMode.STRICT
        },

        // Statut et publication
        status: {
            type: String,
            enum: Object.values(ExamStatus),
            default: ExamStatus.DRAFT
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        publishedAt: {
            type: Date
        },
        validatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        validatedAt: {
            type: Date
        },

        // Configuration
        config: {
            shuffleQuestions: {
                type: Boolean,
                default: false
            },
            shuffleOptions: {
                type: Boolean,
                default: false
            },
            showResultsImmediately: {
                type: Boolean,
                default: true
            },
            allowReview: {
                type: Boolean,
                default: true
            },
            passingScore: {
                type: Number,
                default: 50,
                min: 0,
                max: 100
            },
            maxAttempts: {
                type: Number,
                default: 1,
                min: 1
            },
            timeBetweenAttempts: {
                type: Number,
                default: 0,
                min: 0
            },
            // Feedback immédiat pour évaluations formatives
            enableImmediateFeedback: {
                type: Boolean,
                default: false
            },
            // Auto-évaluation des concepts
            enableSelfAssessment: {
                type: Boolean,
                default: false
            },
            enableGuidedReflection: {
                type: Boolean,
                default: false
            },
            requireConceptEvaluation: {
                type: Boolean,
                default: false
            },
            antiCheat: {
                fullscreenRequired: {
                    type: Boolean,
                    default: true
                },
                trackTabSwitches: {
                    type: Boolean,
                    default: true
                },
                disableCopyPaste: {
                    type: Boolean,
                    default: true
                },
                webcamRequired: {
                    type: Boolean,
                    default: false
                },
                preventScreenshot: {
                    type: Boolean,
                    default: false
                },
                maxTabSwitches: {
                    type: Number,
                    default: 3
                },
                blockRightClick: {
                    type: Boolean,
                    default: true
                }
            },
            // Configuration Late Exam (retardataires)
            lateDuration: {
                type: Number,
                default: 0, // 0 = pas de période late
                min: 0
            },
            lateExamId: {
                type: Schema.Types.ObjectId,
                ref: 'Exam'
            },
            delayResultsUntilLateEnd: {
                type: Boolean,
                default: true // Par défaut, cacher résultats jusqu'à fin de la période late
            }
        },

        // Statistiques (denormalized)
        stats: {
            totalAttempts: {
                type: Number,
                default: 0
            },
            totalCompletions: {
                type: Number,
                default: 0
            },
            averageScore: {
                type: Number,
                default: 0
            },
            averageTime: {
                type: Number,
                default: 0
            },
            passRate: {
                type: Number,
                default: 0
            },
            lastAttemptDate: {
                type: Date
            }
        },

        // Métadonnées
        createdById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        tags: [{
            type: String,
            trim: true
        }],
        version: {
            type: Number,
            default: 1
        },
        previousVersions: [{
            type: Schema.Types.ObjectId,
            ref: 'Exam'
        }]
    },
    {
        timestamps: true
    }
)

// Indexes pour optimiser les requêtes
ExamSchema.index({ title: 'text', description: 'text' }) // Full-text search
ExamSchema.index({ subSystem: 1, targetLevels: 1, subject: 1 }) // Filtrage principal
ExamSchema.index({ startTime: 1, endTime: 1 }) // Requêtes temporelles
ExamSchema.index({ status: 1, isPublished: 1 }) // Filtrage par statut
ExamSchema.index({ createdById: 1, status: 1 }) // Exams d'un teacher
ExamSchema.index({ 'targetFields': 1 }) // Filtrage par série/filière
ExamSchema.index({ 'targetedCompetencies': 1 }) // Filtrage par compétence
ExamSchema.index({ syllabus: 1 }) // Filtrage par syllabus

// Méthode pour calculer le total des points
ExamSchema.methods.getTotalPoints = async function (): Promise<number> {
    const Question = mongoose.model('Question')
    const questions = await Question.find({ examId: this._id })
    return questions.reduce((total, q) => total + (q.points || 1), 0)
}

const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema)

export default Exam
