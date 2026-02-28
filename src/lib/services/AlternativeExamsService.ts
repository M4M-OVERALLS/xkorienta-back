import mongoose from 'mongoose'

// Helper to load models after DB connection
const getModels = () => {
    // Load all referenced models first to enable populate operations
    require('@/models/LearningUnit')
    require('@/models/Subject')
    require('@/models/User')
    require('@/models/Class')
    require('@/models/Exam')

    return {
        Exam: mongoose.model('Exam'),
        Class: mongoose.model('Class'),
        User: mongoose.model('User'),
        LearningUnit: mongoose.model('LearningUnit'),
        Subject: mongoose.model('Subject')
    }
}

/**
 * Service pour gérer les examens alternatifs et la navigation multi-enseignants
 * Feature: Zéro Impasse - L'apprenant a toujours du contenu disponible
 */
export class AlternativeExamsService {
    /**
     * Récupère les examens de l'enseignant principal de l'apprenant pour une UE donnée
     */
    static async getTeacherExams(
        studentId: string,
        learningUnitId?: string,
        subjectId?: string
    ) {
        try {
            const { Class, Exam } = getModels()

            // Trouver la classe de l'étudiant
            const studentClass = await Class.findOne({
                students: new mongoose.Types.ObjectId(studentId),
                isActive: true
            }).populate('mainTeacher', 'firstName lastName')

            if (!studentClass) {
                return {
                    success: false,
                    message: 'Aucune classe trouvée',
                    exams: []
                }
            }

            const teacherId = (studentClass.mainTeacher as any)._id

            // Construire le filtre de recherche
            const filter: any = {
                createdById: teacherId,
                isPublished: true,
                isActive: true,
                status: 'PUBLISHED'
            }

            if (learningUnitId) {
                filter.learningUnit = new mongoose.Types.ObjectId(learningUnitId)
            }

            if (subjectId) {
                filter.subject = new mongoose.Types.ObjectId(subjectId)
            }

            // Récupérer les examens du prof
            const exams = await Exam.find(filter)
                .select('title description subject learningUnit startTime endTime duration stats tags')
                .populate('subject', 'name')
                .populate('learningUnit', 'name')
                .sort({ createdAt: -1 })
                .limit(20)
                .lean()

            return {
                success: true,
                teacher: {
                    id: teacherId,
                    name: `${(studentClass.mainTeacher as any).firstName} ${(studentClass.mainTeacher as any).lastName}`
                },
                exams,
                count: exams.length
            }
        } catch (error: any) {
            console.error('[AlternativeExamsService] Error getting teacher exams:', error)
            throw new Error(error.message || 'Failed to fetch teacher exams')
        }
    }

    /**
     * Récupère les examens alternatifs d'autres enseignants pour la même UE
     */
    static async getAlternativeExams(
        studentId: string,
        learningUnitId?: string,
        subjectId?: string,
        limit: number = 10
    ) {
        try {
            const { Class, Exam } = getModels()

            // Trouver la classe de l'étudiant pour exclure son prof
            const studentClass = await Class.findOne({
                students: new mongoose.Types.ObjectId(studentId),
                isActive: true
            })

            const excludeTeacherId = studentClass?.mainTeacher

            // Construire le filtre
            const filter: any = {
                isPublished: true,
                isActive: true,
                status: 'PUBLISHED'
            }

            if (learningUnitId) {
                filter.learningUnit = new mongoose.Types.ObjectId(learningUnitId)
            }

            if (subjectId) {
                filter.subject = new mongoose.Types.ObjectId(subjectId)
            }

            // Exclure les examens du prof principal
            if (excludeTeacherId) {
                filter.createdById = { $ne: excludeTeacherId }
            }

            // Récupérer les examens alternatifs triés par popularité
            const exams = await Exam.find(filter)
                .select('title description subject learningUnit startTime endTime duration stats tags createdById')
                .populate('subject', 'name')
                .populate('learningUnit', 'name')
                .populate('createdById', 'firstName lastName')
                .sort({ 'stats.totalAttempts': -1, createdAt: -1 }) // Trier par popularité
                .limit(limit)
                .lean()

            return {
                success: true,
                exams,
                count: exams.length
            }
        } catch (error: any) {
            console.error('[AlternativeExamsService] Error getting alternative exams:', error)
            throw new Error(error.message || 'Failed to fetch alternative exams')
        }
    }

    /**
     * Système de fallback automatique : Si le prof n'a pas de tests, propose les plus populaires
     */
    static async getExamsWithFallback(
        studentId: string,
        learningUnitId?: string,
        subjectId?: string
    ) {
        try {
            // 1. Essayer de récupérer les examens du prof principal
            const teacherExamsResult = await this.getTeacherExams(
                studentId,
                learningUnitId,
                subjectId
            )

            // 2. Si le prof a des examens, les retourner
            if (teacherExamsResult.success && teacherExamsResult.exams.length > 0) {
                return {
                    success: true,
                    source: 'teacher',
                    teacher: teacherExamsResult.teacher,
                    exams: teacherExamsResult.exams,
                    message: null
                }
            }

            // 3. Sinon, fallback vers les examens alternatifs (top 3)
            const alternativeExamsResult = await this.getAlternativeExams(
                studentId,
                learningUnitId,
                subjectId,
                3
            )

            // Messages encourageants aléatoires
            const encouragingMessages = [
                "Ton enseignant n'a pas encore publié de test, voici les 3 tests les plus populaires de cette UE pour t'entraîner en attendant 🚀",
                "Ton enseignant prépare du lourd ! En attendant, pourquoi ne pas t'échauffer avec les tests de la communauté Xkorienta sur ce même sujet ? 💪",
                "Pas de test disponible pour le moment ? Pas de panique ! Découvre les meilleurs tests de la communauté pour cette matière 🎯",
                "Ton prof finalise ses tests. En attendant, entraîne-toi avec les contenus les plus appréciés de la plateforme ! ⭐"
            ]

            const randomMessage = encouragingMessages[
                Math.floor(Math.random() * encouragingMessages.length)
            ]

            return {
                success: true,
                source: 'fallback',
                teacher: teacherExamsResult.teacher,
                exams: alternativeExamsResult.exams,
                message: randomMessage,
                isFallback: true
            }
        } catch (error: any) {
            console.error('[AlternativeExamsService] Error in fallback system:', error)
            throw new Error(error.message || 'Failed to fetch exams with fallback')
        }
    }

    /**
     * Recherche d'examens par UE/Matière pour l'onglet "S'entraîner ailleurs"
     */
    static async searchExamsByLearningUnit(
        studentId: string,
        learningUnitId: string,
        page: number = 1,
        limit: number = 10
    ) {
        try {
            const { Class, Exam } = getModels()
            const skip = (page - 1) * limit

            // Trouver la classe de l'étudiant pour exclure son prof
            const studentClass = await Class.findOne({
                students: new mongoose.Types.ObjectId(studentId),
                isActive: true
            })

            const excludeTeacherId = studentClass?.mainTeacher

            const filter: any = {
                learningUnit: new mongoose.Types.ObjectId(learningUnitId),
                isPublished: true,
                isActive: true,
                status: 'PUBLISHED'
            }

            // Exclure les examens du prof principal (optionnel)
            if (excludeTeacherId) {
                filter.createdById = { $ne: excludeTeacherId }
            }

            const [exams, total] = await Promise.all([
                Exam.find(filter)
                    .select('title description subject learningUnit startTime endTime duration stats tags createdById')
                    .populate('subject', 'name')
                    .populate('learningUnit', 'name')
                    .populate('createdById', 'firstName lastName')
                    .sort({ 'stats.totalAttempts': -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Exam.countDocuments(filter)
            ])

            return {
                success: true,
                exams,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        } catch (error: any) {
            console.error('[AlternativeExamsService] Error searching exams:', error)
            throw new Error(error.message || 'Failed to search exams')
        }
    }
}
