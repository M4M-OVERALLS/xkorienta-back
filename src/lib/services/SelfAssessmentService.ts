import SelfAssessmentResult, { ISelfAssessmentResult, ConceptSelfAssessment } from '@/models/SelfAssessmentResult'
import Exam from '@/models/Exam'
import LearningUnit from '@/models/LearningUnit'
import Concept from '@/models/Concept'
import { ExamType, SelfAssessmentLevel } from '@/models/enums'
import mongoose from 'mongoose'

/**
 * DTO pour soumettre une auto-évaluation
 */
export interface SubmitSelfAssessmentDTO {
    examId: string
    studentId: string
    conceptAssessments: Array<{
        conceptId: string
        level: SelfAssessmentLevel
    }>
}

/**
 * Cartographie des compétences d'un élève
 */
export interface CompetencyMap {
    strongConcepts: Array<{
        concept: any
        level: number
    }>
    moderateConcepts: Array<{
        concept: any
        level: number
    }>
    weakConcepts: Array<{
        concept: any
        level: number
    }>
    unknownConcepts: Array<{
        concept: any
        level: number
    }>
}

/**
 * Recommandations personnalisées
 */
export interface Recommendations {
    conceptsToFocus: string[] // Concepts à retravailler en priorité
    suggestedExercises?: string[] // Exercices suggérés
    nextChapterReady: boolean // L'élève est-il prêt pour le chapitre suivant ?
    message: string // Message personnalisé
}

/**
 * SelfAssessmentService - Service pour gérer les auto-évaluations
 *
 * Gère :
 * - Soumission des auto-évaluations
 * - Génération des cartographies de compétences
 * - Suivi de progression dans le temps
 * - Recommandations personnalisées
 * - Analytics pour enseignants
 */
export class SelfAssessmentService {
    /**
     * Soumettre une auto-évaluation
     *
     * @param dto - Données de l'auto-évaluation
     * @returns Résultat créé avec cartographie
     */
    static async submit(dto: SubmitSelfAssessmentDTO): Promise<{
        result: ISelfAssessmentResult
        competencyMap: CompetencyMap
        recommendations: Recommendations
    }> {
        // Vérifier que l'examen existe et est de type SELF_ASSESSMENT
        const exam = await Exam.findById(dto.examId)
        if (!exam) {
            throw new Error(`Examen introuvable : ${dto.examId}`)
        }

        if (exam.examType !== ExamType.SELF_ASSESSMENT) {
            throw new Error(`Cet examen n'est pas une auto-évaluation`)
        }

        // Vérifier que tous les concepts requis sont évalués
        if (exam.selfAssessmentConfig?.requireAllConcepts) {
            const requiredConcepts = exam.linkedConcepts || []
            const evaluatedConcepts = dto.conceptAssessments.map(a => a.conceptId)

            const missingConcepts = requiredConcepts.filter(
                conceptId => !evaluatedConcepts.includes(conceptId.toString())
            )

            if (missingConcepts.length > 0) {
                throw new Error(`Vous devez évaluer tous les concepts. Manquants : ${missingConcepts.length}`)
            }
        }

        // Récupérer le chapitre et le syllabus
        const chapterId = exam.learningUnits?.[0] || exam.learningUnit
        if (!chapterId) {
            throw new Error('Aucun chapitre associé à cet examen')
        }

        const chapter = await LearningUnit.findById(chapterId)
        if (!chapter) {
            throw new Error(`Chapitre introuvable : ${chapterId}`)
        }

        const syllabusId = exam.syllabus
        if (!syllabusId) {
            throw new Error('Aucun syllabus associé à cet examen')
        }

        // Déterminer le numéro de tentative
        const previousAttempts = await SelfAssessmentResult.countDocuments({
            student: dto.studentId,
            chapter: chapterId
        })
        const attemptNumber = previousAttempts + 1

        // Créer les évaluations de concepts
        const conceptAssessments: ConceptSelfAssessment[] = dto.conceptAssessments.map(a => ({
            concept: new mongoose.Types.ObjectId(a.conceptId),
            level: a.level,
            timestamp: new Date()
        }))

        // Créer le résultat (les statistiques sont calculées automatiquement par le pre-save hook)
        const result = new SelfAssessmentResult({
            exam: dto.examId,
            student: dto.studentId,
            chapter: chapterId,
            syllabus: syllabusId,
            conceptAssessments,
            completedAt: new Date(),
            attemptNumber
        })

        await result.save()

        // Générer la cartographie des compétences
        const competencyMap = await this.generateCompetencyMap(result._id.toString())

        // Générer les recommandations
        const recommendations = await this.generateRecommendations(result._id.toString())

        return {
            result,
            competencyMap,
            recommendations
        }
    }

    /**
     * Générer la cartographie des compétences
     *
     * @param resultId - ID du résultat d'auto-évaluation
     * @returns Cartographie avec concepts groupés par niveau de maîtrise
     */
    static async generateCompetencyMap(resultId: string): Promise<CompetencyMap> {
        const result = await SelfAssessmentResult.findById(resultId)
            .populate('conceptAssessments.concept')

        if (!result) {
            throw new Error(`Résultat introuvable : ${resultId}`)
        }

        const strongConcepts = []
        const moderateConcepts = []
        const weakConcepts = []
        const unknownConcepts = []

        for (const assessment of result.conceptAssessments) {
            const item = {
                concept: assessment.concept,
                level: assessment.level
            }

            if (assessment.level >= 5) {
                strongConcepts.push(item)
            } else if (assessment.level >= 3) {
                moderateConcepts.push(item)
            } else if (assessment.level >= 1) {
                weakConcepts.push(item)
            } else {
                unknownConcepts.push(item)
            }
        }

        return {
            strongConcepts,
            moderateConcepts,
            weakConcepts,
            unknownConcepts
        }
    }

    /**
     * Générer des recommandations personnalisées
     *
     * @param resultId - ID du résultat d'auto-évaluation
     * @returns Recommandations avec priorités
     */
    static async generateRecommendations(resultId: string): Promise<Recommendations> {
        const result = await SelfAssessmentResult.findById(resultId)
            .populate('conceptAssessments.concept')

        if (!result) {
            throw new Error(`Résultat introuvable : ${resultId}`)
        }

        // Identifier les concepts à retravailler (niveau < 3)
        const conceptsToFocus = result.conceptAssessments
            .filter(a => a.level < 3)
            .sort((a, b) => a.level - b.level) // Priorité aux plus faibles
            .map(a => (a.concept as any).title || (a.concept as any)._id.toString())

        // Déterminer si l'élève est prêt pour le chapitre suivant
        // Critère : au moins 70% des concepts au niveau 4 ou plus
        const totalConcepts = result.totalConcepts
        const readyConcepts = result.masteredConcepts + result.inProgressConcepts
        const readyPercentage = (readyConcepts / totalConcepts) * 100
        const nextChapterReady = readyPercentage >= 70

        // Générer un message personnalisé
        let message = ''
        const overallScore = result.overallScore

        if (overallScore >= 5) {
            message = '🌟 Excellent ! Vous maîtrisez très bien ce chapitre. Vous pouvez passer au suivant en toute confiance.'
        } else if (overallScore >= 4) {
            message = '😊 Très bien ! Vous avez une bonne compréhension du chapitre. Quelques révisions et vous serez au top.'
        } else if (overallScore >= 3) {
            message = '🙂 Bien ! Vous êtes sur la bonne voie. Focalisez-vous sur les concepts identifiés ci-dessous.'
        } else if (overallScore >= 2) {
            message = '🤔 Vous avez des lacunes importantes. Revoyez les concepts faibles avec votre enseignant ou des exercices.'
        } else {
            message = '😰 Le chapitre semble difficile pour vous. N\'hésitez pas à demander de l\'aide à votre enseignant.'
        }

        // Ajouter conseil spécifique si concepts à retravailler
        if (conceptsToFocus.length > 0) {
            message += `\n\nConcentrez-vous particulièrement sur : ${conceptsToFocus.slice(0, 3).join(', ')}`
        }

        return {
            conceptsToFocus,
            nextChapterReady,
            message
        }
    }

    /**
     * Obtenir l'historique de progression d'un élève sur un concept
     *
     * @param studentId - ID de l'élève
     * @param conceptId - ID du concept
     * @returns Historique avec dates et niveaux
     */
    static async getConceptHistory(
        studentId: string,
        conceptId: string
    ): Promise<Array<{ date: Date; level: number }>> {
        return await (SelfAssessmentResult as any).getConceptHistory(studentId, conceptId)
    }

    /**
     * Obtenir le profil global d'auto-évaluation d'un élève pour une matière
     *
     * @param studentId - ID de l'élève
     * @param syllabusId - ID du syllabus
     * @returns Profil avec scores par chapitre et progression globale
     */
    static async getStudentProfile(studentId: string, syllabusId: string) {
        return await (SelfAssessmentResult as any).getStudentProfile(studentId, syllabusId)
    }

    /**
     * Analytics pour enseignants : vue globale de la classe sur un chapitre
     *
     * @param chapterId - ID du chapitre
     * @param studentIds - IDs des élèves de la classe
     * @returns Analytics avec distribution par concept
     */
    static async getClassAnalytics(chapterId: string, studentIds: string[]) {
        // Récupérer toutes les auto-évaluations de la classe pour ce chapitre
        const results = await SelfAssessmentResult.find({
            chapter: chapterId,
            student: { $in: studentIds }
        })
            .sort({ attemptNumber: -1 }) // Prendre la dernière tentative de chaque élève
            .populate('conceptAssessments.concept')
            .populate('student', 'firstName lastName')

        // Garder seulement la dernière tentative de chaque élève
        const latestByStudent = new Map<string, ISelfAssessmentResult>()
        for (const result of results) {
            const studentId = result.student.toString()
            if (!latestByStudent.has(studentId)) {
                latestByStudent.set(studentId, result)
            }
        }

        const latestResults = Array.from(latestByStudent.values())

        // Calculer la distribution par concept
        const conceptStats = new Map<string, {
            concept: any
            levels: number[]
            averageLevel: number
            studentsStruggling: number
        }>()

        for (const result of latestResults) {
            for (const assessment of result.conceptAssessments) {
                const conceptId = (assessment.concept as any)._id.toString()

                if (!conceptStats.has(conceptId)) {
                    conceptStats.set(conceptId, {
                        concept: assessment.concept,
                        levels: [],
                        averageLevel: 0,
                        studentsStruggling: 0
                    })
                }

                const stats = conceptStats.get(conceptId)!
                stats.levels.push(assessment.level)

                if (assessment.level < 3) {
                    stats.studentsStruggling++
                }
            }
        }

        // Calculer moyennes
        const conceptDifficulty = Array.from(conceptStats.values()).map(stats => {
            const sum = stats.levels.reduce((acc, level) => acc + level, 0)
            stats.averageLevel = sum / stats.levels.length

            return {
                concept: stats.concept,
                averageLevel: stats.averageLevel,
                distribution: {
                    level0: stats.levels.filter(l => l === 0).length,
                    level1: stats.levels.filter(l => l === 1).length,
                    level2: stats.levels.filter(l => l === 2).length,
                    level3: stats.levels.filter(l => l === 3).length,
                    level4: stats.levels.filter(l => l === 4).length,
                    level5: stats.levels.filter(l => l === 5).length,
                    level6: stats.levels.filter(l => l === 6).length
                },
                studentsStruggling: stats.studentsStruggling,
                totalStudents: stats.levels.length
            }
        })

        // Identifier les concepts à revoir en classe (moyenne < 3.5)
        const conceptsNeedingReview = conceptDifficulty
            .filter(c => c.averageLevel < 3.5)
            .sort((a, b) => a.averageLevel - b.averageLevel)

        // Statistiques globales de la classe
        const totalStudents = latestResults.length
        const averageClassScore = latestResults.reduce((sum, r) => sum + r.overallScore, 0) / totalStudents

        return {
            totalStudents,
            averageClassScore,
            conceptDifficulty,
            conceptsNeedingReview,
            studentResults: latestResults.map(r => ({
                student: r.student,
                overallScore: r.overallScore,
                masteredConcepts: r.masteredConcepts,
                strugglingConcepts: r.strugglingConcepts,
                completedAt: r.completedAt
            }))
        }
    }

    /**
     * Comparer deux auto-évaluations pour mesurer la progression
     *
     * @param previousResultId - ID de l'auto-évaluation précédente
     * @param currentResultId - ID de l'auto-évaluation actuelle
     * @returns Rapport de progression
     */
    static async compareResults(previousResultId: string, currentResultId: string) {
        const previous = await SelfAssessmentResult.findById(previousResultId)
        const current = await SelfAssessmentResult.findById(currentResultId)

        if (!previous || !current) {
            throw new Error('Résultats introuvables')
        }

        // Vérifier que c'est le même chapitre
        if (previous.chapter.toString() !== current.chapter.toString()) {
            throw new Error('Les deux auto-évaluations doivent porter sur le même chapitre')
        }

        // Calculer la progression globale
        const scoreDifference = current.overallScore - previous.overallScore
        const percentageChange = (scoreDifference / previous.overallScore) * 100

        // Analyser la progression par concept
        const conceptProgress = []

        for (const currentAssessment of current.conceptAssessments) {
            const conceptId = currentAssessment.concept.toString()
            const previousAssessment = previous.conceptAssessments.find(
                a => a.concept.toString() === conceptId
            )

            if (previousAssessment) {
                const progress = currentAssessment.level - previousAssessment.level

                conceptProgress.push({
                    concept: currentAssessment.concept,
                    previousLevel: previousAssessment.level,
                    currentLevel: currentAssessment.level,
                    progress,
                    improved: progress > 0,
                    stagnated: progress === 0,
                    regressed: progress < 0
                })
            }
        }

        // Compter les améliorations, stagnations, régressions
        const improved = conceptProgress.filter(c => c.improved).length
        const stagnated = conceptProgress.filter(c => c.stagnated).length
        const regressed = conceptProgress.filter(c => c.regressed).length

        return {
            previous: {
                overallScore: previous.overallScore,
                completedAt: previous.completedAt
            },
            current: {
                overallScore: current.overallScore,
                completedAt: current.completedAt
            },
            progression: {
                scoreDifference,
                percentageChange,
                improved,
                stagnated,
                regressed
            },
            conceptProgress: conceptProgress.sort((a, b) => b.progress - a.progress) // Trier par progression
        }
    }
}
