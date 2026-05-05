import { IExam } from '@/models/Exam'
import { ExamBuilder, ExamContext, ExamTarget, ExamTiming, ValidationResult } from '@/lib/builders/ExamBuilder'
import { ExamBuilderFactory } from '@/lib/builders/ExamBuilderFactory'
import { ExamTemplate, getTemplateById, getTemplateByExamType, getAllTemplates, getTemplatesByCategory } from '@/lib/exam-templates/ExamTemplate'
import { Cycle, ExamStatus } from '@/models/enums'
import Exam from '@/models/Exam'
import School from '@/models/School'
import mongoose from 'mongoose'

/**
 * DTO pour initialiser un examen V4
 */
export interface InitializeExamDTO {
    templateId: string
    title?: string
    description?: string
}

/**
 * DTO pour mettre à jour le contexte
 */
export interface UpdateContextDTO {
    schoolId?: string
    classId?: string
    targetLevelIds: string[]
}

/**
 * DTO pour mettre à jour la cible
 */
export interface UpdateTargetDTO {
    subjectId: string
    syllabusId?: string
    learningUnitIds?: string[]
    chapterWeights?: Array<{
        learningUnit: string
        weight: number
    }>
    linkedConceptIds?: string[]
    targetFieldIds?: string[]
}

/**
 * DTO pour mettre à jour le timing
 */
export interface UpdateTimingDTO {
    startTime: Date
    endTime: Date
    duration: number
}

/**
 * DTO pour mettre à jour les métadonnées
 */
export interface UpdateMetadataDTO {
    title: string
    description?: string
    imageUrl?: string
    tags?: string[]
}

/**
 * État d'un brouillon en cours de création
 */
interface DraftState {
    examId: string
    builder: ExamBuilder
    context?: ExamContext
    target?: ExamTarget
    timing?: ExamTiming
    metadata?: UpdateMetadataDTO
    lastSaved: Date
    createdById: string
}

/**
 * ExamServiceV4 - Service pour gérer la création d'examens avec l'architecture V4
 *
 * Utilise les patterns Builder et Template pour :
 * - Création progressive avec validation
 * - Auto-save des brouillons
 * - Configuration basée sur templates
 * - Support multi-chapitres
 */
export class ExamServiceV4 {
    // Cache en mémoire des brouillons en cours (en prod, utiliser Redis)
    private static draftStates = new Map<string, DraftState>()

    /**
     * Lister tous les templates disponibles
     */
    static async listTemplates(options?: {
        category?: 'DIAGNOSTIC' | 'FORMATIVE' | 'SUMMATIVE' | 'SPECIAL' | 'COMPETITION' | 'ADAPTIVE'
    }): Promise<ExamTemplate[]> {
        if (options?.category) {
            return getTemplatesByCategory(options.category)
        }
        return getAllTemplates()
    }

    /**
     * Obtenir un template par ID
     */
    static async getTemplate(templateId: string): Promise<ExamTemplate | null> {
        const template = getTemplateById(templateId)
        return template || null
    }

    /**
     * Initialiser un nouveau builder avec un template
     *
     * @param dto - Template ID et métadonnées initiales
     * @param createdById - ID de l'utilisateur
     * @returns ID du brouillon créé
     */
    static async initialize(dto: InitializeExamDTO, createdById: string): Promise<{
        draftId: string
        template: ExamTemplate
    }> {
        const template = getTemplateById(dto.templateId)
        if (!template) {
            throw new Error(`Template introuvable : ${dto.templateId}`)
        }

        // Créer le builder
        const builder = new ExamBuilder(template)

        // Définir les métadonnées si fournies
        if (dto.title) {
            builder.setMetadata({
                title: dto.title,
                description: dto.description
            })
        }

        // Sauvegarder le brouillon en base de données
        const draft = await builder.saveDraft(createdById)

        // Stocker l'état du builder en cache
        const draftState: DraftState = {
            examId: draft._id.toString(),
            builder,
            lastSaved: new Date(),
            createdById
        }

        this.draftStates.set(draft._id.toString(), draftState)

        return {
            draftId: draft._id.toString(),
            template
        }
    }

    /**
     * Récupérer ou recréer le state d'un brouillon
     * Si le cache est vide (après redémarrage), recharge depuis la BD
     */
    private static async getOrRestoreDraftState(draftId: string): Promise<DraftState> {
        // Vérifier le cache d'abord
        let state = this.draftStates.get(draftId)

        if (!state) {
            // Charger depuis la BD
            const exam = await Exam.findById(draftId)
            if (!exam) {
                throw new Error(`Brouillon introuvable : ${draftId}`)
            }

            if (exam.status !== ExamStatus.DRAFT) {
                throw new Error(`Cet examen n'est pas un brouillon (statut: ${exam.status})`)
            }

            // Récupérer le template
            if (!exam.examType) {
                throw new Error(`Type d'examen manquant pour le brouillon`)
            }
            const template = getTemplateByExamType(exam.examType)
            if (!template) {
                throw new Error(`Template introuvable pour l'examen`)
            }

            // Recréer le builder
            const builder = new ExamBuilder(template)

            // Restaurer les données depuis l'examen
            if (exam.title) {
                builder.setMetadata({
                    title: exam.title,
                    description: exam.description,
                    imageUrl: exam.imageUrl,
                    tags: exam.tags
                })
            }

            // Reconstruire le state
            state = {
                examId: exam._id.toString(),
                builder,
                lastSaved: exam.updatedAt || new Date(),
                createdById: exam.createdById.toString()
            }

            // Sauvegarder dans le cache
            this.draftStates.set(draftId, state)
        }

        return state
    }

    /**
     * Mettre à jour le contexte (école + niveaux)
     *
     * @param draftId - ID du brouillon
     * @param dto - Contexte
     * @returns Résultat de validation
     */
    static async updateContext(draftId: string, dto: UpdateContextDTO): Promise<{
        success: boolean
        validation: ValidationResult
    }> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Récupérer les cycles de l'école si schoolId fourni
        let schoolCycles: Cycle[] | undefined
        if (dto.schoolId) {
            const school = await School.findById(dto.schoolId)
            if (school?.cycles && school.cycles.length > 0) {
                schoolCycles = school.cycles
            }
        }

        // Construire le contexte
        const context: ExamContext = {
            schoolId: dto.schoolId,
            classId: dto.classId,
            targetLevelIds: dto.targetLevelIds,
            schoolCycles
        }

        // Mettre à jour le builder
        state.builder.setContext(context)
        state.context = context

        // Valider
        const validation = await state.builder.validate()

        // Auto-save
        await this.autoSave(draftId)

        return {
            success: validation.valid,
            validation
        }
    }

    /**
     * Mettre à jour la cible pédagogique (matière + syllabus + chapitres)
     *
     * @param draftId - ID du brouillon
     * @param dto - Cible pédagogique
     * @returns Résultat de validation
     */
    static async updateTarget(draftId: string, dto: UpdateTargetDTO): Promise<{
        success: boolean
        validation: ValidationResult
    }> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Construire la cible
        const target: ExamTarget = {
            subjectId: dto.subjectId,
            syllabusId: dto.syllabusId,
            learningUnitIds: dto.learningUnitIds,
            chapterWeights: dto.chapterWeights?.map(w => ({
                learningUnit: w.learningUnit as any,
                weight: w.weight
            })),
            linkedConceptIds: dto.linkedConceptIds,
            targetFieldIds: dto.targetFieldIds
        }

        // Mettre à jour le builder
        state.builder.setTarget(target)
        state.target = target

        // Valider
        const validation = await state.builder.validate()

        // Auto-save
        await this.autoSave(draftId)

        return {
            success: validation.valid,
            validation
        }
    }

    /**
     * Mettre à jour le timing (dates + durée)
     *
     * @param draftId - ID du brouillon
     * @param dto - Timing
     * @returns Résultat de validation
     */
    static async updateTiming(draftId: string, dto: UpdateTimingDTO): Promise<{
        success: boolean
        validation: ValidationResult
    }> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Construire le timing
        const timing: ExamTiming = {
            startTime: new Date(dto.startTime),
            endTime: new Date(dto.endTime),
            duration: dto.duration
        }

        // Mettre à jour le builder
        state.builder.setTiming(timing)
        state.timing = timing

        // Valider
        const validation = await state.builder.validate()

        // Auto-save
        await this.autoSave(draftId)

        return {
            success: validation.valid,
            validation
        }
    }

    /**
     * Mettre à jour les métadonnées (titre + description + image + tags)
     *
     * @param draftId - ID du brouillon
     * @param dto - Métadonnées
     * @returns Résultat de validation
     */
    static async updateMetadata(draftId: string, dto: UpdateMetadataDTO): Promise<{
        success: boolean
        validation: ValidationResult
    }> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Mettre à jour le builder
        state.builder.setMetadata(dto)
        state.metadata = dto

        // Valider
        const validation = await state.builder.validate()

        // Auto-save
        await this.autoSave(draftId)

        return {
            success: validation.valid,
            validation
        }
    }

    /**
     * Valider un brouillon complet
     *
     * @param draftId - ID du brouillon
     * @returns Résultat de validation complet
     */
    static async validate(draftId: string): Promise<ValidationResult> {
        const state = await this.getOrRestoreDraftState(draftId)

        return await state.builder.validate()
    }

    /**
     * Publier un examen (le rendre actif)
     *
     * @param draftId - ID du brouillon
     * @returns Examen publié
     */
    static async publish(draftId: string): Promise<IExam> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Validation finale
        const validation = await state.builder.validate()
        if (!validation.valid) {
            throw new Error(`Validation échouée : ${validation.errors.join(', ')}`)
        }

        // Construire et publier
        const exam = await state.builder.build(state.createdById, true)

        // Nettoyer le cache
        this.draftStates.delete(draftId)

        return exam
    }

    /**
     * Sauvegarder un brouillon sans le publier
     *
     * @param draftId - ID du brouillon
     * @returns Examen en mode brouillon
     */
    static async saveDraft(draftId: string): Promise<IExam> {
        const state = await this.getOrRestoreDraftState(draftId)

        // Mettre à jour le brouillon existant en base
        const exam = await Exam.findById(draftId)
        if (!exam) {
            throw new Error(`Examen introuvable : ${draftId}`)
        }

        // Mettre à jour les champs si modifiés
        if (state.context) {
            exam.targetLevels = state.context.targetLevelIds.map(id => id as any)
        }
        if (state.target) {
            exam.subject = state.target.subjectId as any
            exam.syllabus = state.target.syllabusId as any
            exam.learningUnits = state.target.learningUnitIds?.map(id => id as any)
            exam.chapterWeights = state.target.chapterWeights as any
            exam.linkedConcepts = state.target.linkedConceptIds?.map(id => id as any)
        }
        if (state.timing) {
            exam.startTime = state.timing.startTime
            exam.endTime = state.timing.endTime
            exam.duration = state.timing.duration
        }
        if (state.metadata) {
            exam.title = state.metadata.title
            exam.description = state.metadata.description
            exam.imageUrl = state.metadata.imageUrl
            exam.tags = state.metadata.tags || []
        }

        exam.status = ExamStatus.DRAFT
        state.lastSaved = new Date()

        await exam.save()
        return exam
    }

    /**
     * Auto-save automatique d'un brouillon
     * (Appelé après chaque modification)
     */
    private static async autoSave(draftId: string): Promise<void> {
        try {
            await this.saveDraft(draftId)
        } catch (error) {
            console.error(`Auto-save échoué pour ${draftId}:`, error)
            // Ne pas throw - auto-save ne doit pas bloquer
        }
    }

    /**
     * Récupérer un brouillon existant pour le reprendre
     *
     * @param draftId - ID du brouillon
     * @param userId - ID de l'utilisateur (vérification ownership)
     * @returns État du brouillon reconstitué
     */
    static async resumeDraft(draftId: string, userId: string): Promise<{
        exam: IExam
        validation: ValidationResult
    }> {
        const exam = await Exam.findById(draftId)
        if (!exam) {
            throw new Error(`Brouillon introuvable : ${draftId}`)
        }

        // Vérifier ownership
        if (exam.createdById.toString() !== userId) {
            throw new Error('Non autorisé : vous n\'êtes pas le créateur de ce brouillon')
        }

        // Vérifier que c'est bien un brouillon
        if (exam.status !== ExamStatus.DRAFT) {
            throw new Error('Cet examen n\'est pas un brouillon')
        }

        // Reconstituer le builder depuis l'examen existant
        const builder = ExamBuilderFactory.fromExamType(exam.examType!)

        // Reconstituer le contexte
        if (exam.targetLevels && exam.targetLevels.length > 0) {
            const school = exam.schoolType ? await School.findOne({ type: exam.schoolType }) : undefined
            builder.setContext({
                schoolId: school?._id.toString(),
                targetLevelIds: exam.targetLevels.map(id => id.toString()),
                schoolCycles: school?.cycles
            })
        }

        // Reconstituer la cible
        if (exam.subject) {
            builder.setTarget({
                subjectId: exam.subject.toString(),
                syllabusId: exam.syllabus?.toString(),
                learningUnitIds: exam.learningUnits?.map(id => id.toString()),
                chapterWeights: exam.chapterWeights?.map(w => ({
                    learningUnit: new mongoose.Types.ObjectId(w.learningUnit),
                    weight: w.weight
                })),
                linkedConceptIds: exam.linkedConcepts?.map(id => id.toString())
            })
        }

        // Reconstituer le timing
        builder.setTiming({
            startTime: exam.startTime,
            endTime: exam.endTime,
            duration: exam.duration
        })

        // Reconstituer les métadonnées
        builder.setMetadata({
            title: exam.title,
            description: exam.description,
            imageUrl: exam.imageUrl,
            tags: exam.tags
        })

        // Stocker l'état en cache
        const state: DraftState = {
            examId: exam._id.toString(),
            builder,
            lastSaved: exam.updatedAt,
            createdById: userId
        }
        this.draftStates.set(exam._id.toString(), state)

        // Valider
        const validation = await builder.validate()

        return {
            exam,
            validation
        }
    }

    /**
     * Supprimer un brouillon
     *
     * @param draftId - ID du brouillon
     * @param userId - ID de l'utilisateur (vérification ownership)
     */
    static async deleteDraft(draftId: string, userId: string): Promise<void> {
        const exam = await Exam.findById(draftId)
        if (!exam) {
            throw new Error(`Brouillon introuvable : ${draftId}`)
        }

        // Vérifier ownership
        if (exam.createdById.toString() !== userId) {
            throw new Error('Non autorisé : vous n\'êtes pas le créateur de ce brouillon')
        }

        // Vérifier que c'est bien un brouillon
        if (exam.status !== ExamStatus.DRAFT) {
            throw new Error('Seuls les brouillons peuvent être supprimés')
        }

        // Supprimer de la base
        await Exam.findByIdAndDelete(draftId)

        // Nettoyer le cache
        this.draftStates.delete(draftId)
    }

    /**
     * Lister les brouillons d'un utilisateur
     *
     * @param userId - ID de l'utilisateur
     * @returns Liste des brouillons
     */
    static async listDrafts(userId: string): Promise<IExam[]> {
        return await Exam.find({
            createdById: userId,
            status: ExamStatus.DRAFT,
            createdWithV4: true
        }).sort({ updatedAt: -1 })
    }

    /**
     * Nettoyer les brouillons anciens (>30 jours)
     * À exécuter via CRON job
     */
    static async cleanupOldDrafts(): Promise<number> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        const result = await Exam.deleteMany({
            status: ExamStatus.DRAFT,
            updatedAt: { $lt: thirtyDaysAgo }
        })

        return result.deletedCount || 0
    }
}
