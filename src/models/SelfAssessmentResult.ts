import mongoose, { Schema, Document, Model } from 'mongoose'
import { SelfAssessmentLevel } from './enums'

/**
 * Auto-évaluation d'un concept par un élève
 * Représente l'évaluation d'un seul concept sur l'échelle à 7 niveaux
 */
export interface ConceptSelfAssessment {
    concept: mongoose.Types.ObjectId // Référence vers Concept
    level: SelfAssessmentLevel // Niveau 0-6 sur l'échelle d'auto-évaluation
    timestamp: Date // Quand l'élève s'est évalué
}

/**
 * Interface principale : Résultat d'auto-évaluation
 * Stocke toutes les auto-évaluations d'un élève pour un chapitre
 */
export interface ISelfAssessmentResult extends Document {
    _id: mongoose.Types.ObjectId

    // Références principales
    exam: mongoose.Types.ObjectId // Référence vers l'examen (type SELF_ASSESSMENT)
    student: mongoose.Types.ObjectId // L'élève qui s'est auto-évalué
    chapter: mongoose.Types.ObjectId // Le chapitre (LearningUnit) évalué
    syllabus: mongoose.Types.ObjectId // Le syllabus auquel appartient le chapitre

    // Auto-évaluations par concept
    conceptAssessments: ConceptSelfAssessment[] // Un élément par concept évalué

    // Statistiques agrégées (denormalized pour performance)
    overallScore: number // Score moyen sur tous les concepts (0-6)
    totalConcepts: number // Nombre total de concepts évalués

    // Répartition par niveau de maîtrise
    masteredConcepts: number // Nombre de concepts niveau 5-6
    inProgressConcepts: number // Nombre de concepts niveau 3-4
    strugglingConcepts: number // Nombre de concepts niveau 1-2
    unknownConcepts: number // Nombre de concepts niveau 0

    // Métadonnées
    completedAt: Date // Date de complétion de l'auto-évaluation
    attemptNumber: number // Numéro de la tentative (permet suivi progression dans le temps)

    createdAt: Date
    updatedAt: Date
}

const SelfAssessmentResultSchema = new Schema<ISelfAssessmentResult>(
    {
        exam: {
            type: Schema.Types.ObjectId,
            ref: 'Exam',
            required: true
        },
        student: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        chapter: {
            type: Schema.Types.ObjectId,
            ref: 'LearningUnit',
            required: true
        },
        syllabus: {
            type: Schema.Types.ObjectId,
            ref: 'Syllabus',
            required: true
        },

        // Auto-évaluations par concept
        conceptAssessments: [
            {
                concept: {
                    type: Schema.Types.ObjectId,
                    ref: 'Concept',
                    required: true
                },
                level: {
                    type: Number,
                    enum: Object.values(SelfAssessmentLevel).filter(v => typeof v === 'number'),
                    required: true
                },
                timestamp: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        // Statistiques agrégées
        overallScore: {
            type: Number,
            min: 0,
            max: 6,
            default: 0
        },
        totalConcepts: {
            type: Number,
            default: 0
        },
        masteredConcepts: {
            type: Number,
            default: 0
        },
        inProgressConcepts: {
            type: Number,
            default: 0
        },
        strugglingConcepts: {
            type: Number,
            default: 0
        },
        unknownConcepts: {
            type: Number,
            default: 0
        },

        // Métadonnées
        completedAt: {
            type: Date,
            required: true
        },
        attemptNumber: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        timestamps: true
    }
)

// Index pour optimiser les requêtes
SelfAssessmentResultSchema.index({ student: 1, chapter: 1, attemptNumber: 1 }) // Progression d'un élève sur un chapitre
SelfAssessmentResultSchema.index({ exam: 1, student: 1 }) // Résultats d'un élève pour un examen
SelfAssessmentResultSchema.index({ chapter: 1, completedAt: -1 }) // Dernières auto-évaluations par chapitre
SelfAssessmentResultSchema.index({ student: 1, syllabus: 1 }) // Vue globale élève par syllabus
SelfAssessmentResultSchema.index({ 'conceptAssessments.concept': 1 }) // Filtrage par concept

// Pre-save hook : calculer les statistiques agrégées automatiquement
SelfAssessmentResultSchema.pre('save', async function () {
    const assessments = this.conceptAssessments

    // Total concepts
    this.totalConcepts = assessments.length

    // Score moyen
    if (assessments.length > 0) {
        const sum = assessments.reduce((acc, a) => acc + a.level, 0)
        this.overallScore = sum / assessments.length
    } else {
        this.overallScore = 0
    }

    // Répartition par niveau
    this.masteredConcepts = assessments.filter(a => a.level >= 5).length
    this.inProgressConcepts = assessments.filter(a => a.level >= 3 && a.level < 5).length
    this.strugglingConcepts = assessments.filter(a => a.level >= 1 && a.level < 3).length
    this.unknownConcepts = assessments.filter(a => a.level === 0).length
})

/**
 * Méthode statique : récupérer l'historique d'auto-évaluations d'un élève sur un concept
 */
SelfAssessmentResultSchema.statics.getConceptHistory = async function (
    studentId: string,
    conceptId: string
): Promise<Array<{ date: Date; level: number }>> {
    const results = await this.find({
        student: studentId,
        'conceptAssessments.concept': conceptId
    }).sort({ completedAt: 1 })

    const history: Array<{ date: Date; level: number }> = []

    results.forEach((result: ISelfAssessmentResult) => {
        const assessment = result.conceptAssessments.find(
            (a: ConceptSelfAssessment) => a.concept.toString() === conceptId
        )
        if (assessment) {
            history.push({
                date: assessment.timestamp,
                level: assessment.level
            })
        }
    })

    return history
}

/**
 * Méthode statique : obtenir le profil d'auto-évaluation global d'un élève pour une matière
 */
SelfAssessmentResultSchema.statics.getStudentProfile = async function (
    studentId: string,
    syllabusId: string
) {
    const results = await this.find({
        student: studentId,
        syllabus: syllabusId
    }).populate('chapter')

    const chapterScores = results.map((result: ISelfAssessmentResult) => ({
        chapter: result.chapter,
        averageLevel: result.overallScore,
        strongConcepts: result.masteredConcepts,
        moderateConcepts: result.inProgressConcepts,
        weakConcepts: result.strugglingConcepts,
        unknownConcepts: result.unknownConcepts,
        lastAssessmentDate: result.completedAt
    }))

    // Agrégation globale
    const totalConcepts = results.reduce((sum: number, r: ISelfAssessmentResult) => sum + r.totalConcepts, 0)
    const masteredConcepts = results.reduce((sum: number, r: ISelfAssessmentResult) => sum + r.masteredConcepts, 0)
    const inProgressConcepts = results.reduce((sum: number, r: ISelfAssessmentResult) => sum + r.inProgressConcepts, 0)
    const strugglingConcepts = results.reduce((sum: number, r: ISelfAssessmentResult) => sum + r.strugglingConcepts, 0)
    const unknownConcepts = results.reduce((sum: number, r: ISelfAssessmentResult) => sum + r.unknownConcepts, 0)

    return {
        student: studentId,
        syllabus: syllabusId,
        chapterScores,
        overallProgress: {
            totalConcepts,
            masteredConcepts,
            inProgressConcepts,
            strugglingConcepts,
            unknownConcepts
        }
    }
}

const SelfAssessmentResult: Model<ISelfAssessmentResult> =
    mongoose.models.SelfAssessmentResult ||
    mongoose.model<ISelfAssessmentResult>('SelfAssessmentResult', SelfAssessmentResultSchema)

export default SelfAssessmentResult
