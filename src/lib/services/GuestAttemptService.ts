import crypto from 'crypto'
import mongoose from 'mongoose'
import Exam from '@/models/Exam'
import Attempt from '@/models/Attempt'
import Question from '@/models/Question'
import Option from '@/models/Option'
import Response from '@/models/Response'
import Subject from '@/models/Subject'
import LearningUnit from '@/models/LearningUnit'
import { AttemptStatus } from '@/models/Attempt'

/**
 * Service pour gérer les tentatives d'examen en mode Guest (Freemium-Direct)
 * Permet aux utilisateurs anonymes de passer des mini-tests sans inscription
 */
export class GuestAttemptService {
    /**
     * Démarre une tentative guest pour un mini-test public
     */
    static async startGuestAttempt(examId: string, guestSessionId: string) {
        const exam = await Exam.findById(examId)
        if (!exam) throw new Error("Exam not found")

        // Vérifier que c'est bien un mini-test public
        if (!exam.isPublicDemo) {
            throw new Error("This exam is not available for guest access")
        }

        // Vérifier que l'examen est publié et actif
        if (!exam.isPublished || !exam.isActive) {
            throw new Error("Exam is not available")
        }

        // Vérifier les dates
        const now = new Date()
        if (exam.startTime && now < exam.startTime) {
            throw new Error("Exam has not started yet")
        }
        if (exam.endTime && now > exam.endTime) {
            throw new Error("Exam has ended")
        }

        // Vérifier si une tentative guest existe déjà pour cette session
        const existingAttempt = await Attempt.findOne({
            examId: exam._id,
            guestSessionId,
            status: { $in: [AttemptStatus.STARTED, AttemptStatus.COMPLETED] }
        })

        if (existingAttempt) {
            // Si déjà complétée, permettre une nouvelle tentative (mini-tests illimités pour guests)
            if (existingAttempt.status === AttemptStatus.COMPLETED) {
                // Continue pour créer une nouvelle tentative
            } else {
                // Retourner la tentative en cours
                return {
                    attemptId: existingAttempt._id,
                    resumeToken: existingAttempt.resumeToken,
                    config: exam.config,
                    startedAt: existingAttempt.startedAt,
                    duration: exam.duration,
                    isResume: true
                }
            }
        }

        // Générer un token de reprise sécurisé
        const resumeToken = crypto.randomBytes(32).toString('hex')

        // Créer la tentative guest
        const attempt = await Attempt.create({
            examId: exam._id,
            guestSessionId, // Pas de userId pour les guests
            status: AttemptStatus.STARTED,
            startedAt: now,
            expiresAt: new Date(now.getTime() + (exam.duration || 5) * 60 * 1000), // Default 5min pour mini-tests
            resumeToken,
            antiCheatEvents: [],
            tabSwitchCount: 0,
            suspiciousActivityDetected: false
        })

        // Mettre à jour les stats de l'examen
        await Exam.findByIdAndUpdate(examId, {
            $inc: { 'stats.totalAttempts': 1 }
        })

        return {
            attemptId: attempt._id,
            resumeToken,
            config: exam.config,
            startedAt: attempt.startedAt,
            duration: exam.duration,
            isResume: false
        }
    }

    /**
     * Récupère les questions d'un mini-test pour un guest
     */
    static async getGuestExamQuestions(examId: string, guestSessionId: string) {
        const exam = await Exam.findById(examId)
        if (!exam) throw new Error("Exam not found")

        if (!exam.isPublicDemo) {
            throw new Error("This exam is not available for guest access")
        }

        // Vérifier qu'une tentative existe pour cette session
        const attempt = await Attempt.findOne({
            examId: exam._id,
            guestSessionId,
            status: AttemptStatus.STARTED
        })

        if (!attempt) {
            throw new Error("No active attempt found. Please start the exam first.")
        }

        // Récupérer les questions
        let questions = await Question.find({ examId: exam._id })
            .select('-correctAnswer -modelAnswer -openQuestionConfig.keywords') // Masquer les réponses
            .sort({ order: 1 })
            .lean()

        // Shuffle si configuré
        if (exam.config.shuffleQuestions) {
            questions = this.shuffleArray(questions)
        }

        // Toutes les questions de l'examen sont servies (pas de limite arbitraire)

        // Récupérer les options pour chaque question
        const questionsWithOptions = await Promise.all(
            questions.map(async (q) => {
                const options = await Option.find({ questionId: q._id })
                    .select('_id text order')
                    .sort({ order: 1 })
                    .lean()

                return {
                    _id: q._id,
                    text: q.text,
                    imageUrl: q.imageUrl,
                    type: q.type,
                    points: q.points,
                    order: q.order,
                    options: options.map(opt => ({
                        _id: opt._id,
                        text: opt.text
                    }))
                }
            })
        )

        return {
            examId: exam._id,
            title: exam.title,
            description: exam.description,
            duration: exam.duration,
            questions: questionsWithOptions,
            config: exam.config,
            attemptId: attempt._id
        }
    }

    /**
     * Soumet une réponse pour un guest
     */
    static async submitGuestResponse(
        attemptId: string,
        questionId: string,
        selectedOptionId: string | null,
        textResponse: string | null,
        guestSessionId: string
    ) {
        const attempt = await Attempt.findById(attemptId)
        if (!attempt) throw new Error("Attempt not found")

        // Vérifier que c'est bien une tentative guest de cette session
        if (attempt.guestSessionId !== guestSessionId) {
            throw new Error("Unauthorized")
        }

        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt is not active")
        }

        const question = await Question.findById(questionId)
        if (!question) throw new Error("Question not found")

        // Vérifier la réponse (logique simplifiée pour guests)
        let isCorrect = false
        if (question.type === 'QCM' && selectedOptionId) {
            const Option = mongoose.model('Option')
            const option = await Option.findById(selectedOptionId)
            isCorrect = option?.isCorrect || false
        } else if (question.type === 'TRUE_FALSE') {
            // Pour TRUE_FALSE, selectedOptionId contient "true" ou "false"
            isCorrect = selectedOptionId === String(question.correctAnswer)
        }

        // Créer ou mettre à jour la réponse
        await Response.findOneAndUpdate(
            { attemptId: attempt._id, questionId: question._id },
            {
                attemptId: attempt._id,
                questionId: question._id,
                selectedOptionId: selectedOptionId ? new mongoose.Types.ObjectId(selectedOptionId) : undefined,
                textResponse,
                isCorrect,
                answeredAt: new Date()
            },
            { upsert: true, new: true }
        )

        return { success: true, isCorrect }
    }

    /**
     * Soumet la tentative guest et calcule le score
     */
    static async submitGuestAttempt(attemptId: string, guestSessionId: string) {
        const attempt = await Attempt.findById(attemptId)
        if (!attempt) throw new Error("Attempt not found")

        if (attempt.guestSessionId !== guestSessionId) {
            throw new Error("Unauthorized")
        }

        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt already submitted")
        }

        // Récupérer toutes les réponses
        const responses = await Response.find({ attemptId: attempt._id })
        const questions = await Question.find({ examId: attempt.examId })

        // Calculer le score
        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
        const earnedPoints = responses
            .filter(r => r.isCorrect)
            .reduce((sum, r) => {
                const question = questions.find(q => q._id.toString() === r.questionId.toString())
                return sum + (question?.points || 1)
            }, 0)

        const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0

        // Mettre à jour la tentative
        const now = new Date()
        await Attempt.findByIdAndUpdate(attemptId, {
            status: AttemptStatus.COMPLETED,
            submittedAt: now,
            score: earnedPoints,
            maxScore: totalPoints,
            percentage: Math.round(percentage * 10) / 10,
            timeSpent: Math.round((now.getTime() - attempt.startedAt.getTime()) / 60000) // minutes
        })

        // Mettre à jour les stats de l'examen
        await Exam.findByIdAndUpdate(attempt.examId, {
            $inc: { 'stats.totalCompletions': 1 }
        })

        return {
            score: earnedPoints,
            maxScore: totalPoints,
            percentage: Math.round(percentage * 10) / 10,
            totalQuestions: questions.length,
            correctAnswers: responses.filter(r => r.isCorrect).length
        }
    }

    /**
     * Récupère les résultats détaillés d'une tentative guest
     */
    static async getGuestAttemptResults(attemptId: string, guestSessionId: string) {
        const attempt = await Attempt.findById(attemptId)
        if (!attempt) throw new Error("Attempt not found")

        if (attempt.guestSessionId !== guestSessionId) {
            throw new Error("Unauthorized")
        }

        if (attempt.status !== AttemptStatus.COMPLETED) {
            throw new Error("Attempt not completed yet")
        }

        const exam = await Exam.findById(attempt.examId)
            .populate('subject')
            .populate('learningUnit')

        const responses = await Response.find({ attemptId: attempt._id })
            .populate('questionId')
            .lean()

        const questions = await Question.find({ examId: attempt.examId }).lean()

        // Construire les résultats détaillés
        const detailedResults = questions.map(question => {
            const response = responses.find(r => r.questionId._id.toString() === question._id.toString())
            return {
                questionId: question._id,
                questionText: question.text,
                isCorrect: response?.isCorrect || false,
                points: question.points || 1,
                earnedPoints: response?.isCorrect ? (question.points || 1) : 0,
                tags: question.tags || []
            }
        })

        return {
            attemptId: attempt._id,
            exam: {
                id: exam?._id,
                title: exam?.title,
                subject: (exam?.subject as any)?.name,
                learningUnit: (exam?.learningUnit as any)?.title
            },
            score: attempt.score,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            timeSpent: attempt.timeSpent,
            submittedAt: attempt.submittedAt,
            results: detailedResults
        }
    }

    /**
     * Utilitaire pour mélanger un tableau (Fisher-Yates shuffle)
     */
    private static shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }
}
