import { IExam } from "@/models/Exam"
import { ExamStatus, EvaluationType, DifficultyLevel, PedagogicalObjective, CloseMode } from "@/models/enums"
import { EvaluationStrategyFactory } from "@/lib/patterns/EvaluationStrategy"
import mongoose from "mongoose"

// Helper to get models after DB connection
const getExamModel = () => {
    // Load all referenced models first to enable populate operations
    require("@/models/EducationLevel")
    require("@/models/Subject")
    require("@/models/LearningUnit")
    require("@/models/Field")
    require("@/models/Competency")
    require("@/models/User")
    require("@/models/Exam")
    return mongoose.model<IExam>('Exam')
}

const getQuestionModel = () => {
    require("@/models/Question")
    return mongoose.model('Question')
}

/**
 * Service V2 pour la gestion avancée des examens
 * Intègre les nouveaux champs V2 et le pattern Strategy
 */
export class ExamServiceV2 {
    /**
     * Récupère les examens avec filtres avancés
     */
    static async getExams(filters: {
        status?: ExamStatus
        level?: string
        subject?: string
        field?: string
        learningUnit?: string
        competency?: string
        evaluationType?: EvaluationType
        difficultyLevel?: DifficultyLevel
        createdBy?: string
        isPublished?: boolean
        limit?: number
        skip?: number
    } = {}) {
        const query: any = {}

        if (filters.status) query.status = filters.status
        if (filters.level) query.targetLevels = filters.level
        if (filters.subject) query.subject = filters.subject
        if (filters.field) query.targetFields = filters.field
        if (filters.learningUnit) query.learningUnit = filters.learningUnit
        if (filters.competency) query.targetedCompetencies = filters.competency
        if (filters.evaluationType) query.evaluationType = filters.evaluationType
        if (filters.difficultyLevel) query.difficultyLevel = filters.difficultyLevel
        if (filters.createdBy) query.createdById = filters.createdBy
        if (filters.isPublished !== undefined) query.isPublished = filters.isPublished

        const limit = filters.limit || 20
        const skip = filters.skip || 0

        const Exam = getExamModel()
        const exams = await Exam.find(query)
            .populate('targetLevels', 'name code cycle')
            .populate('subject', 'name code')
            .populate('learningUnit', 'name code')
            .populate('targetFields', 'name code')
            .populate('targetedCompetencies', 'name description')
            .populate('createdById', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean()

        const total = await Exam.countDocuments(query)

        return { exams, total, limit, skip }
    }

    /**
     * Récupère un examen par ID avec toutes les relations
     */
    static async getExamById(id: string, includeQuestions: boolean = false) {
        const Exam = getExamModel()
        const exam = await Exam.findById(id)
            .populate('targetLevels', 'name code cycle')
            .populate('subject', 'name code')
            .populate('learningUnit', 'name code')
            .populate('targetFields', 'name code')
            .populate('targetedCompetencies', 'name description')
            .populate('createdById', 'name email')
            .lean()

        if (!exam) return null

        if (includeQuestions) {
            const Question = getQuestionModel()
            const questions = await Question.find({ examId: id })
                .lean()

            // Fetch options for each question if needed
            // Load options for all question types that might have them
            const questionsWithOptions = await Promise.all(questions.map(async (q: any) => {
                const typesWithOptions = [EvaluationType.QCM, EvaluationType.TRUE_FALSE, EvaluationType.MIXED]
                if (typesWithOptions.includes(q.type) || !q.type) {
                    const Option = (await import("@/models/Option")).default
                    const options = await Option.find({ questionId: q._id }).sort({ order: 1 }).lean()
                    return { ...q, options }
                }
                return { ...q, options: [] }
            }))

            return { ...exam, questions: questionsWithOptions }
        }

        return exam
    }

    /**
     * Convertit les anciennes valeurs d'enum vers les nouvelles
     */
    private static normalizeLegacyEnums(examData: Partial<IExam>) {
        // Convert legacy closeMode
        if (examData.closeMode === 'MANUAL' as any) {
            examData.closeMode = CloseMode.STRICT
        }

        // Convert legacy difficultyLevel
        const difficultyMap: Record<string, DifficultyLevel> = {
            'EASY': DifficultyLevel.BEGINNER,
            'MEDIUM': DifficultyLevel.INTERMEDIATE,
            'HARD': DifficultyLevel.ADVANCED
        }

        if (examData.difficultyLevel && difficultyMap[examData.difficultyLevel as string]) {
            examData.difficultyLevel = difficultyMap[examData.difficultyLevel as string]
        }
    }

    /**
     * Nettoie les champs ObjectId vides pour éviter les CastErrors
     */
    private static cleanupObjectIdFields(data: any) {
        const idFields = ['learningUnit', 'targetLevels', 'targetFields', 'targetedCompetencies', 'subject', 'syllabus', 'linkedConcepts']
        idFields.forEach(field => {
            if (data[field] === "") {
                delete data[field]
            }
            // Also handle arrays if they contain empty strings
            if (Array.isArray(data[field])) {
                data[field] = data[field].filter((id: string) => id !== "")
            }
        })
    }

    /**
     * Crée un nouvel examen V2
     */
    static async createExam(examData: Partial<IExam> & { questions?: any[] }, createdBy: string) {
        // Valider les données
        if (!examData.title || !examData.subject) {
            throw new Error("Title and subject are required")
        }

        // Normalize legacy enum values
        this.normalizeLegacyEnums(examData)

        // Cleanup empty strings for ObjectId fields to prevent CastErrors
        this.cleanupObjectIdFields(examData)

        try {
            // Définir les valeurs par défaut V2
            const Exam = getExamModel()
            const createdExam = await Exam.create({
                ...examData,
                createdById: createdBy,
                status: ExamStatus.DRAFT,
                isPublished: false,
                version: 1,
                config: {
                    shuffleQuestions: examData.config?.shuffleQuestions ?? false,
                    shuffleOptions: examData.config?.shuffleOptions ?? false,
                    showResultsImmediately: examData.config?.showResultsImmediately ?? true,
                    allowReview: examData.config?.allowReview ?? true,
                    passingScore: examData.config?.passingScore ?? 50,
                    maxAttempts: examData.config?.maxAttempts ?? 1,
                    timeBetweenAttempts: examData.config?.timeBetweenAttempts ?? 0,
                    antiCheat: {
                        fullscreenRequired: examData.config?.antiCheat?.fullscreenRequired ?? false,
                        disableCopyPaste: examData.config?.antiCheat?.disableCopyPaste ?? false,
                        trackTabSwitches: examData.config?.antiCheat?.trackTabSwitches ?? false,
                        blockRightClick: examData.config?.antiCheat?.blockRightClick ?? false,
                        preventScreenshot: examData.config?.antiCheat?.preventScreenshot ?? false,
                        webcamRequired: examData.config?.antiCheat?.webcamRequired ?? false,
                        maxTabSwitches: examData.config?.antiCheat?.maxTabSwitches ?? 3
                    }
                },
                stats: {
                    totalAttempts: 0,
                    totalCompletions: 0,
                    averageScore: 0,
                    passRate: 0,
                    averageTime: 0
                }
            })

            // Create questions if provided
            if (examData.questions && examData.questions.length > 0) {
                const Option = (await import("@/models/Option")).default
                const Question = getQuestionModel()

                for (let i = 0; i < examData.questions.length; i++) {
                    const qData = examData.questions[i]

                    const createdQuestion = await Question.create({
                        examId: createdExam._id,
                        text: qData.text,
                        type: qData.type,
                        points: qData.points,
                        difficulty: qData.difficulty,
                        timeLimit: qData.timeLimit,
                        correctAnswer: qData.correctAnswer,
                        modelAnswer: qData.modelAnswer,
                        openQuestionConfig: qData.openQuestionConfig,
                        order: i,
                        stats: {
                            timesAsked: 0,
                            timesCorrect: 0,
                            timesIncorrect: 0,
                            successRate: 0
                        }
                    })

                    // Create options for QCM and TRUE_FALSE
                    if ((qData.type === EvaluationType.QCM || qData.type === EvaluationType.TRUE_FALSE || qData.type === EvaluationType.MIXED)) {
                        let optionsToCreate = []

                        if (qData.options && qData.options.length > 0) {
                            // Use provided options, filtering out any with empty text
                            optionsToCreate = qData.options
                                .filter((opt: any) => opt.text && opt.text.trim() !== '')
                                .map((opt: any, idx: number) => ({
                                    questionId: createdQuestion._id,
                                    text: opt.text,
                                    isCorrect: opt.isCorrect,
                                    order: idx,
                                    stats: {
                                        timesSelected: 0,
                                        selectionRate: 0
                                    }
                                }))
                        } else if (qData.type === EvaluationType.TRUE_FALSE) {
                            // Generate default TRUE/FALSE options if not provided
                            // Determine which is correct based on qData.correctAnswer
                            // Expecting query.correctAnswer to be "true", "Vrai", etc.
                            const isTrueCorrect = String(qData.correctAnswer).toLowerCase() === 'true' || String(qData.correctAnswer).toLowerCase() === 'vrai';

                            optionsToCreate = [
                                {
                                    questionId: createdQuestion._id,
                                    text: "Vrai",
                                    isCorrect: isTrueCorrect,
                                    order: 0,
                                    stats: { timesSelected: 0, selectionRate: 0 }
                                },
                                {
                                    questionId: createdQuestion._id,
                                    text: "Faux",
                                    isCorrect: !isTrueCorrect,
                                    order: 1,
                                    stats: { timesSelected: 0, selectionRate: 0 }
                                }
                            ]
                        }

                        if (optionsToCreate.length > 0) {
                            await Option.create(optionsToCreate)
                        }
                    }
                }
            }

            return createdExam
        } catch (error) {
            throw error
        }
    }

    /**
     * Met à jour un examen
     */
    static async updateExam(id: string, updateData: Partial<IExam>, userId: string) {
        const Exam = getExamModel()
        const exam = await Exam.findById(id)
        if (!exam) throw new Error("Exam not found")

        // Vérifier les permissions (à améliorer avec AccessHandler)
        if (exam.createdById.toString() !== userId) {
            throw new Error("Unauthorized to update this exam")
        }

        // Ne pas permettre la modification si l'examen est publié (sauf certains champs)
        if (exam.status === ExamStatus.PUBLISHED) {
            const allowedFields = ['isPublished', 'endTime']
            const attemptedFields = Object.keys(updateData)
            const unauthorized = attemptedFields.filter(f => !allowedFields.includes(f))

            if (unauthorized.length > 0) {
                throw new Error("Cannot modify published exam except isPublished and endTime")
            }
        }

        // Normalize legacy enum values
        this.normalizeLegacyEnums(updateData)
        this.cleanupObjectIdFields(updateData)

        // Incrémenter la version si modification majeure
        if ((updateData as any).questions || updateData.config) {
            updateData.version = (exam.version || 1) + 1
        }

        const updatedExam = await Exam.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('targetLevels', 'name code')
            .populate('subject', 'name code')
            .populate('learningUnit', 'name code')

        return updatedExam
    }

    /**
     * Suppression douce (archive)
     */
    static async deleteExam(id: string, userId: string) {
        const Exam = getExamModel()
        const exam = await Exam.findById(id)
        if (!exam) throw new Error("Exam not found")

        // Vérifier les permissions
        if (exam.createdById.toString() !== userId) {
            throw new Error("Unauthorized to delete this exam")
        }

        // Soft delete: changer le statut à ARCHIVED
        exam.status = ExamStatus.ARCHIVED
        exam.isPublished = false
        await exam.save()

        return { success: true, message: "Exam archived successfully" }
    }

    /**
     * Recherche full-text
     */
    static async searchExams(query: string, filters: any = {}) {
        const searchQuery: any = {
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ]
        }

        // Ajouter les filtres additionnels
        if (filters.status) searchQuery.status = filters.status
        if (filters.subject) searchQuery.subject = filters.subject
        if (filters.level) searchQuery.targetLevels = filters.level

        const Exam = getExamModel()
        const exams = await Exam.find(searchQuery)
            .populate('targetLevels', 'name code')
            .populate('subject', 'name code')
            .populate('createdById', 'name')
            .limit(20)
            .lean()

        return exams
    }

    /**
     * Filtrage avancé avec critères multiples
     */
    static async filterExams(criteria: {
        targetLevels?: string[]
        targetFields?: string[]
        competencies?: string[]
        subject?: string
        evaluationType?: EvaluationType
        difficultyLevel?: DifficultyLevel
        pedagogicalObjective?: PedagogicalObjective
        status?: ExamStatus
    }) {
        const query: any = {}

        if (criteria.targetLevels?.length) {
            query.targetLevels = { $in: criteria.targetLevels }
        }
        if (criteria.targetFields?.length) {
            query.targetFields = { $in: criteria.targetFields }
        }
        if (criteria.competencies?.length) {
            query.targetedCompetencies = { $in: criteria.competencies }
        }
        if (criteria.subject) {
            query.subject = criteria.subject
        }
        if (criteria.evaluationType) {
            query.evaluationType = criteria.evaluationType
        }
        if (criteria.difficultyLevel) {
            query.difficultyLevel = criteria.difficultyLevel
        }
        if (criteria.pedagogicalObjective) {
            query.pedagogicalObjective = criteria.pedagogicalObjective
        }
        if (criteria.status) {
            query.status = criteria.status
        }

        const Exam = getExamModel()
        const exams = await Exam.find(query)
            .populate('targetLevels', 'name code')
            .populate('subject', 'name code')
            .populate('targetFields', 'name code')
            .populate('targetedCompetencies', 'name')
            .populate('createdById', 'name')
            .lean()

        return exams
    }

    /**
     * Évalue un examen avec la stratégie appropriée
     */
    static async evaluateExam(exam: IExam, responses: any[], questions: any[]) {
        return await EvaluationStrategyFactory.evaluateExam(exam, responses, questions)
    }
}
