import { IExam } from '@/models/Exam'
import { EvaluationStrategyFactory, EvaluationResult } from '@/lib/patterns/EvaluationStrategy'
import { ExamDecoratorFactory } from '@/lib/patterns/ExamDecorator'
import Attempt, { AttemptStatus } from '@/models/Attempt'
import Response from '@/models/Response'
import Question from '@/models/Question'
import mongoose from 'mongoose'

/**
 * Service d'évaluation d'examen combinant Strategy et Decorator Patterns
 * 
 * Utilise le Strategy Pattern pour choisir la méthode d'évaluation
 * et le Decorator Pattern pour enrichir les résultats
 */
export class ExamEvaluationService {
    /**
     * Évalue une tentative d'examen complète
     */
    static async evaluateAttempt(
        attemptId: mongoose.Types.ObjectId,
        options: {
            enableTimeBonus?: boolean
            enableStreakBonus?: boolean
            enableBadges?: boolean
            enableDetailedStats?: boolean
        } = {}
    ): Promise<EvaluationResult> {
        // Récupérer la tentative
        const attempt = await Attempt.findById(attemptId)
        if (!attempt) {
            throw new Error('Attempt not found')
        }

        // Récupérer l'examen
        const exam = await mongoose.model<IExam>('Exam').findById(attempt.examId)
        if (!exam) {
            throw new Error('Exam not found')
        }

        // Récupérer les questions
        const questions = await Question.find({ examId: exam._id }).lean()

        // Récupérer les réponses
        const responses = await Response.find({ attemptId: attempt._id }).lean()

        // Calculer le temps passé
        const timeSpent = attempt.submittedAt && attempt.startedAt
            ? (new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / (1000 * 60)
            : undefined

        // Étape 1: Évaluation avec Strategy Pattern
        const baseResult = await EvaluationStrategyFactory.evaluateExam(
            exam,
            responses,
            questions
        )

        // Étape 2: Enrichissement avec Decorator Pattern
        const enhancedResult = ExamDecoratorFactory.applyDecorators(
            baseResult,
            exam,
            {
                timeSpent,
                responses,
                questions,
                enableTimeBonus: options.enableTimeBonus ?? true,
                enableStreakBonus: options.enableStreakBonus ?? true,
                enableBadges: options.enableBadges ?? true,
                enableDetailedStats: options.enableDetailedStats ?? true
            }
        )

        // Mettre à jour la tentative avec le score
        attempt.score = enhancedResult.score
        await attempt.save()

        // Mettre à jour les statistiques de l'examen
        await this.updateExamStats(exam, enhancedResult, timeSpent)

        return enhancedResult
    }

    /**
     * Met à jour les statistiques de l'examen après une évaluation
     */
    private static async updateExamStats(
        exam: IExam,
        result: EvaluationResult,
        timeSpent?: number
    ): Promise<void> {
        const currentStats = exam.stats

        // Incrémenter le nombre de tentatives
        currentStats.totalAttempts += 1

        // Incrémenter les complétions
        currentStats.totalCompletions += 1

        // Mettre à jour la moyenne des scores
        const totalScore = currentStats.averageScore * (currentStats.totalCompletions - 1) + result.percentage
        currentStats.averageScore = totalScore / currentStats.totalCompletions

        // Mettre à jour le taux de réussite
        const previousPasses = currentStats.passRate * (currentStats.totalCompletions - 1) / 100
        const newPasses = previousPasses + (result.passed ? 1 : 0)
        currentStats.passRate = (newPasses / currentStats.totalCompletions) * 100

        // Mettre à jour le temps moyen
        if (timeSpent) {
            const totalTime = currentStats.averageTime * (currentStats.totalCompletions - 1) + timeSpent
            currentStats.averageTime = totalTime / currentStats.totalCompletions
        }

        // Mettre à jour la date de dernière tentative
        currentStats.lastAttemptDate = new Date()

        await exam.save()
    }

    /**
     * Prévisualise le résultat sans sauvegarder
     */
    static async previewEvaluation(
        examId: mongoose.Types.ObjectId,
        responses: any[],
        questions: any[]
    ): Promise<EvaluationResult> {
        const exam = await mongoose.model<IExam>('Exam').findById(examId)
        if (!exam) {
            throw new Error('Exam not found')
        }

        // Évaluation de base
        const baseResult = await EvaluationStrategyFactory.evaluateExam(
            exam,
            responses,
            questions
        )

        // Enrichissement (sans bonus temporel car c'est une prévisualisation)
        return ExamDecoratorFactory.applyDecorators(
            baseResult,
            exam,
            {
                responses,
                questions,
                enableBadges: true,
                enableDetailedStats: true
            }
        )
    }

    /**
     * Obtient les statistiques globales d'un examen
     */
    static async getExamStatistics(examId: mongoose.Types.ObjectId): Promise<{
        totalAttempts: number
        totalCompletions: number
        averageScore: number
        averageTime: number
        passRate: number
        lastAttemptDate?: Date
        distribution: {
            excellent: number  // 90-100%
            good: number       // 75-89%
            average: number    // 50-74%
            poor: number       // 0-49%
        }
    }> {
        const exam = await mongoose.model<IExam>('Exam').findById(examId)
        if (!exam) {
            throw new Error('Exam not found')
        }

        // Récupérer toutes les tentatives complétées
        const attempts = await Attempt.find({
            examId,
            status: AttemptStatus.COMPLETED
        }).lean()

        // Calculer la distribution
        const distribution = {
            excellent: 0,
            good: 0,
            average: 0,
            poor: 0
        }

        for (const attempt of attempts) {
            const percentage = (attempt.score || 0) / await exam.getTotalPoints() * 100

            if (percentage >= 90) distribution.excellent++
            else if (percentage >= 75) distribution.good++
            else if (percentage >= 50) distribution.average++
            else distribution.poor++
        }

        return {
            ...exam.stats,
            distribution
        }
    }
}
