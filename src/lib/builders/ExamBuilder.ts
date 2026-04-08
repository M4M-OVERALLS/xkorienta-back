import mongoose from 'mongoose'
import Exam, { IExam, ExamConfig, ChapterWeight, SelfAssessmentConfig } from '@/models/Exam'
import { ExamType, DifficultyLevel, Cycle } from '@/models/enums'
import { ExamTemplate } from '@/lib/exam-templates/ExamTemplate'
import EducationLevel from '@/models/EducationLevel'
import School from '@/models/School'

/**
 * Contexte de création d'examen (école + niveaux cibles)
 */
export interface ExamContext {
    schoolId?: string
    classId?: string
    targetLevelIds: string[]
    schoolCycles?: Cycle[] // Cycles effectivement enseignés par l'école
}

/**
 * Cible pédagogique (matière + syllabus + chapitres + concepts)
 */
export interface ExamTarget {
    subjectId: string
    syllabusId?: string
    learningUnitIds?: string[] // Chapitres (multi-chapitres supporté)
    chapterWeights?: ChapterWeight[] // Pondération optionnelle par chapitre
    linkedConceptIds?: string[] // Concepts liés (pour auto-évaluation)
    targetFieldIds?: string[] // Séries/Filières cibles
}

/**
 * Configuration temporelle de l'examen
 */
export interface ExamTiming {
    startTime: Date
    endTime: Date
    duration: number // Durée en minutes
}

/**
 * Résultat de la validation
 */
export interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
}

/**
 * ExamBuilder - Pattern Builder pour créer des examens de manière progressive
 *
 * Fonctionnalités :
 * - Construction fluente étape par étape
 * - Validation à chaque étape
 * - Configuration basée sur templates
 * - Support brouillons (draft)
 */
export class ExamBuilder {
    private template: ExamTemplate
    private context?: ExamContext
    private target?: ExamTarget
    private timing?: ExamTiming
    private customConfig?: Partial<ExamConfig>
    private title?: string
    private description?: string
    private imageUrl?: string
    private tags?: string[]

    constructor(template: ExamTemplate) {
        this.template = template
    }

    /**
     * Définir le contexte (école + classes + niveaux)
     */
    setContext(context: ExamContext): this {
        this.context = context
        return this
    }

    /**
     * Définir la cible pédagogique (matière + syllabus + chapitres)
     */
    setTarget(target: ExamTarget): this {
        this.target = target
        return this
    }

    /**
     * Définir le timing (dates + durée)
     */
    setTiming(timing: ExamTiming): this {
        this.timing = timing
        return this
    }

    /**
     * Définir les métadonnées (titre + description + image + tags)
     */
    setMetadata(metadata: {
        title: string
        description?: string
        imageUrl?: string
        tags?: string[]
    }): this {
        this.title = metadata.title
        this.description = metadata.description
        this.imageUrl = metadata.imageUrl
        this.tags = metadata.tags
        return this
    }

    /**
     * Personnaliser la configuration (override les valeurs du template)
     */
    customizeConfig(config: Partial<ExamConfig>): this {
        this.customConfig = config
        return this
    }

    /**
     * Valider le contexte
     */
    private async validateContext(): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []

        if (!this.context) {
            errors.push('Le contexte (école/classe/niveaux) est requis')
            return { valid: false, errors, warnings }
        }

        // Vérifier que les niveaux cibles existent
        if (!this.context.targetLevelIds || this.context.targetLevelIds.length === 0) {
            errors.push('Au moins un niveau cible est requis')
        }

        // Vérifier la compatibilité des niveaux avec l'école
        if (this.context.schoolId && this.context.targetLevelIds.length > 0) {
            const school = await School.findById(this.context.schoolId)
            if (!school) {
                errors.push(`École introuvable : ${this.context.schoolId}`)
                return { valid: false, errors, warnings }
            }

            // Vérifier chaque niveau
            for (const levelId of this.context.targetLevelIds) {
                const level = await EducationLevel.findById(levelId)
                if (!level) {
                    errors.push(`Niveau introuvable : ${levelId}`)
                    continue
                }

                // Si l'école a des cycles définis, vérifier la compatibilité
                if (school.cycles && school.cycles.length > 0) {
                    if (!school.cycles.includes(level.cycle)) {
                        errors.push(
                            `Le niveau "${level.name}" (${level.cycle}) n'est pas enseigné dans cette école (cycles: ${school.cycles.join(', ')})`
                        )
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors, warnings }
    }

    /**
     * Valider la cible pédagogique
     */
    private async validateTarget(): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []

        if (!this.target) {
            errors.push('La cible pédagogique (matière + syllabus) est requise')
            return { valid: false, errors, warnings }
        }

        if (!this.target.subjectId) {
            errors.push('La matière est requise')
        }

        // Validation spécifique pour auto-évaluation
        if (this.template.examType === ExamType.SELF_ASSESSMENT) {
            if (!this.target.learningUnitIds || this.target.learningUnitIds.length === 0) {
                errors.push('L\'auto-évaluation nécessite au moins un chapitre')
            }
            if (this.target.learningUnitIds && this.target.learningUnitIds.length > 1) {
                warnings.push('L\'auto-évaluation est généralement faite sur UN chapitre à la fois')
            }
            if (!this.target.linkedConceptIds || this.target.linkedConceptIds.length === 0) {
                errors.push('L\'auto-évaluation nécessite des concepts liés')
            }
        }

        // Validation pour examens multi-chapitres
        const multiChapterTypes = [
            ExamType.FINAL_EXAM,
            ExamType.MIDTERM_EXAM,
            ExamType.CONTINUOUS_ASSESSMENT,
            ExamType.MOCK_EXAM
        ]

        if (multiChapterTypes.includes(this.template.examType)) {
            if (!this.target.learningUnitIds || this.target.learningUnitIds.length < 2) {
                warnings.push(
                    `Un ${this.template.name} couvre généralement plusieurs chapitres (${this.template.recommendations.idealChapterCount} recommandés)`
                )
            }
        }

        // Validation pondération chapitres
        if (this.target.chapterWeights && this.target.chapterWeights.length > 0) {
            const totalWeight = this.target.chapterWeights.reduce((sum, w) => sum + w.weight, 0)
            if (Math.abs(totalWeight - 100) > 0.01) {
                errors.push(`La somme des pondérations doit être 100% (actuel: ${totalWeight}%)`)
            }
        }

        return { valid: errors.length === 0, errors, warnings }
    }

    /**
     * Valider le timing
     */
    private async validateTiming(): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []

        if (!this.timing) {
            errors.push('Le timing (dates + durée) est requis')
            return { valid: false, errors, warnings }
        }

        const { startTime, endTime, duration } = this.timing

        if (startTime >= endTime) {
            errors.push('La date de fin doit être après la date de début')
        }

        if (duration <= 0) {
            errors.push('La durée doit être positive')
        }

        // Vérifier si la durée est cohérente avec les recommandations
        const suggestedDuration = this.template.defaultConfig.suggestedDuration || 60
        if (duration < suggestedDuration * 0.5) {
            warnings.push(
                `La durée semble courte pour un ${this.template.name} (${duration} min vs ${suggestedDuration} min recommandés)`
            )
        }
        if (duration > suggestedDuration * 2) {
            warnings.push(
                `La durée semble longue pour un ${this.template.name} (${duration} min vs ${suggestedDuration} min recommandés)`
            )
        }

        return { valid: errors.length === 0, errors, warnings }
    }

    /**
     * Valider l'examen complet avant création
     */
    async validate(): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []

        // Valider chaque étape
        const contextValidation = await this.validateContext()
        const targetValidation = await this.validateTarget()
        const timingValidation = await this.validateTiming()

        errors.push(...contextValidation.errors)
        errors.push(...targetValidation.errors)
        errors.push(...timingValidation.errors)

        warnings.push(...contextValidation.warnings)
        warnings.push(...targetValidation.warnings)
        warnings.push(...timingValidation.warnings)

        // Validation des métadonnées
        if (!this.title || this.title.trim().length === 0) {
            errors.push('Le titre est requis')
        }

        return { valid: errors.length === 0, errors, warnings }
    }

    /**
     * Construire l'examen final
     * @param createdById - ID de l'utilisateur créateur
     * @param publish - Publier immédiatement (sinon reste en DRAFT)
     */
    async build(createdById: string, publish = false): Promise<IExam> {
        // Validation finale
        const validation = await this.validate()
        if (!validation.valid) {
            throw new Error(`Validation échouée: ${validation.errors.join(', ')}`)
        }

        if (!this.context || !this.target || !this.timing) {
            throw new Error('Contexte, cible et timing sont requis')
        }

        // Récupérer le subSystem depuis le premier niveau cible
        const firstLevel = await EducationLevel.findById(this.context.targetLevelIds[0])
        if (!firstLevel) {
            throw new Error('Niveau cible introuvable')
        }

        // Fusionner la config du template avec la config personnalisée
        const finalConfig: ExamConfig = {
            // Valeurs du template
            shuffleQuestions: this.template.defaultConfig.shuffleQuestions ?? false,
            shuffleOptions: this.template.defaultConfig.shuffleOptions ?? false,
            showResultsImmediately: this.template.defaultConfig.showResultsImmediately ?? true,
            allowReview: this.template.defaultConfig.allowReview ?? true,
            passingScore: this.template.defaultConfig.passingScore ?? 50,
            maxAttempts: this.template.defaultConfig.maxAttempts ?? 1,
            timeBetweenAttempts: this.template.defaultConfig.timeBetweenAttempts ?? 0,
            enableImmediateFeedback: this.template.defaultConfig.enableImmediateFeedback ?? false,
            antiCheat: this.template.defaultConfig.antiCheat ?? {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },

            // Override avec config personnalisée
            ...this.customConfig
        }

        // Créer l'examen
        const exam = new Exam({
            // Métadonnées
            title: this.title!,
            description: this.description,
            imageUrl: this.imageUrl,
            tags: this.tags || [],

            // Classification éducative
            schoolType: this.context.schoolId
                ? (await School.findById(this.context.schoolId))?.type
                : undefined,
            subSystem: firstLevel.subSystem,
            targetLevels: this.context.targetLevelIds,
            subject: this.target.subjectId,
            syllabus: this.target.syllabusId,

            // 🆕 V4 - Multi-chapitres
            learningUnits: this.target.learningUnitIds,
            chapterWeights: this.target.chapterWeights,
            linkedConcepts: this.target.linkedConceptIds,
            targetFields: this.target.targetFieldIds,

            // 🆕 V4 - Type d'examen précis
            examType: this.template.examType,
            graded: this.template.defaultConfig.graded ?? true,
            weightInFinalGrade: this.template.defaultConfig.weightInFinalGrade,
            selfAssessmentConfig: this.template.defaultConfig.selfAssessmentConfig,
            createdWithV4: true,

            // Objectifs pédagogiques
            pedagogicalObjective: this.template.defaultConfig.pedagogicalObjective!,
            evaluationType: this.template.defaultConfig.evaluationType!,
            learningMode: this.template.defaultConfig.learningMode!,
            difficultyLevel: this.template.defaultConfig.difficultyLevel ?? DifficultyLevel.INTERMEDIATE,

            // Timing
            startTime: this.timing.startTime,
            endTime: this.timing.endTime,
            duration: this.timing.duration,
            closeMode: this.template.defaultConfig.closeMode!,

            // Statut
            status: publish ? 'PUBLISHED' : 'DRAFT',
            isPublished: publish,
            isActive: true,
            publishedAt: publish ? new Date() : undefined,

            // Configuration
            config: finalConfig,

            // Statistiques (initialisées à 0)
            stats: {
                totalAttempts: 0,
                totalCompletions: 0,
                averageScore: 0,
                averageTime: 0,
                passRate: 0
            },

            // Métadonnées
            createdById: new mongoose.Types.ObjectId(createdById),
            version: 1
        })

        await exam.save()
        return exam
    }

    /**
     * Sauvegarder un brouillon (draft) sans validation complète
     * Permet de sauvegarder progressivement pendant la création
     */
    async saveDraft(createdById: string): Promise<IExam> {
        // Validation minimale
        if (!this.title || this.title.trim().length === 0) {
            throw new Error('Le titre est requis même pour un brouillon')
        }

        const exam = new Exam({
            title: this.title,
            description: this.description,
            imageUrl: this.imageUrl,
            tags: this.tags || [],

            // Champs optionnels (peuvent être incomplets)
            subSystem: 'FRANCOPHONE', // Valeur par défaut
            targetLevels: this.context?.targetLevelIds || [],
            subject: this.target?.subjectId,
            syllabus: this.target?.syllabusId,
            learningUnits: this.target?.learningUnitIds,
            chapterWeights: this.target?.chapterWeights,

            // V4
            examType: this.template.examType,
            graded: this.template.defaultConfig.graded,
            createdWithV4: true,

            // Valeurs par défaut minimales
            pedagogicalObjective: this.template.defaultConfig.pedagogicalObjective!,
            evaluationType: this.template.defaultConfig.evaluationType!,
            learningMode: this.template.defaultConfig.learningMode!,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,

            // Timing par défaut (peut être incomplet)
            startTime: this.timing?.startTime || new Date(),
            endTime: this.timing?.endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 jours
            duration: this.timing?.duration || this.template.defaultConfig.suggestedDuration || 60,
            closeMode: this.template.defaultConfig.closeMode!,

            // Statut DRAFT
            status: 'DRAFT',
            isPublished: false,
            isActive: false,

            // Config minimale
            config: this.template.defaultConfig as ExamConfig,

            stats: {
                totalAttempts: 0,
                totalCompletions: 0,
                averageScore: 0,
                averageTime: 0,
                passRate: 0
            },

            createdById: new mongoose.Types.ObjectId(createdById),
            version: 1
        })

        await exam.save()
        return exam
    }
}
