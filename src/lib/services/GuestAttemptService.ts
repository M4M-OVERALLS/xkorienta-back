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

        // Vérifier que c'est bien un exam accessible sans login :
        // - isPublicDemo (mini-test manuel)
        // - OU examContext 'PUBLIC' avec statut PUBLISHED
        const isGuestAccessible =
            exam.isPublicDemo ||
            ((exam as any).examContext === 'PUBLIC' && (exam as any).status === 'PUBLISHED')

        if (!isGuestAccessible) {
            throw new Error("This exam is not available for guest access")
        }

        // Vérifier que l'examen est actif
        if (!exam.isActive) {
            throw new Error("Exam is not available")
        }
        // Pour les examens PUBLIC, isPublished est géré via status === PUBLISHED
        if (!exam.isPublicDemo && !exam.isPublished && (exam as any).status !== 'PUBLISHED') {
            throw new Error("Exam is not available")
        }

        const now = new Date()

        // Vérifier les dates SEULEMENT pour les mini-tests isPublicDemo
        // Les examens examContext='PUBLIC' sont des mini-tests permanents → pas de fenêtre horaire
        const isPublicContextExam = (exam as any).examContext === 'PUBLIC'
        if (!isPublicContextExam) {
            if (exam.startTime && now < exam.startTime) {
                throw new Error("Exam has not started yet")
            }
            if (exam.endTime && now > exam.endTime) {
                throw new Error("Exam has ended")
            }
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

        const isGuestAccessible =
            exam.isPublicDemo ||
            ((exam as any).examContext === 'PUBLIC' && (exam as any).status === 'PUBLISHED')

        if (!isGuestAccessible) {
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
        if (exam.config?.shuffleQuestions) {
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
     * Soumet une réponse pour un guest.
     *
     * SECURITY (A-01): N'évalue PAS isCorrect ici — l'évaluation est
     * différée au submitGuestAttempt() pour empêcher l'oracle de réponse.
     *
     * Le guestSessionId est lié à l'empreinte IP + User-Agent (A-09)
     * pour limiter la réutilisation de sessions entre appareils.
     */
    static async submitGuestResponse(
        attemptId: string,
        questionId: string,
        selectedOptionId: string | null,
        textResponse: string | null,
        guestSessionId: string,
        headers?: Headers
    ) {
        const attempt = await Attempt.findById(attemptId)
        if (!attempt) throw new Error("Attempt not found")

        if (attempt.guestSessionId !== guestSessionId) {
            throw new Error("Unauthorized")
        }

        // A-09: Bind guestSessionId to IP + User-Agent fingerprint
        if (headers) {
            const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                || headers.get('x-real-ip')
                || 'unknown'
            const ua = headers.get('user-agent') || 'unknown'
            const fingerprint = crypto
                .createHash('sha256')
                .update(`${guestSessionId}:${ip}:${ua}`)
                .digest('hex')
                .substring(0, 16)

            // Store fingerprint on first request, reject mismatches after
            if (!attempt.clientFingerprint) {
                await Attempt.findByIdAndUpdate(attemptId, { clientFingerprint: fingerprint })
            } else if (attempt.clientFingerprint !== fingerprint) {
                throw new Error("Session mismatch — please restart the test")
            }
        }

        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt is not active")
        }

        const question = await Question.findById(questionId)
        if (!question) throw new Error("Question not found")

        // A-01: Record the answer WITHOUT evaluating correctness
        await Response.findOneAndUpdate(
            { attemptId: attempt._id, questionId: question._id },
            {
                attemptId: attempt._id,
                questionId: question._id,
                selectedOptionId: selectedOptionId ? new mongoose.Types.ObjectId(selectedOptionId) : undefined,
                textResponse,
                answeredAt: new Date()
            },
            { upsert: true, new: true }
        )

        return { recorded: true }
    }

    /**
     * Soumet la tentative guest et calcule le score.
     *
     * SECURITY (A-01): L'évaluation de isCorrect se fait ICI (au submit),
     * pas dans submitGuestResponse(). Cela empêche l'oracle de réponse.
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

        // Récupérer toutes les réponses et questions
        const responses = await Response.find({ attemptId: attempt._id })
        const questions = await Question.find({ examId: attempt.examId })
        const questionIds = questions.map(q => q._id)
        const options = await Option.find({ questionId: { $in: questionIds } })

        // A-01: Evaluate correctness NOW (server-side, at submit time)
        const optionMap = new Map(options.map(o => [o._id.toString(), o.isCorrect]))

        let earnedPoints = 0
        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
        let correctCount = 0

        for (const response of responses) {
            const question = questions.find(q => q._id.toString() === response.questionId.toString())
            if (!question) continue

            let isCorrect = false

            if (question.type === 'QCM' && response.selectedOptionId) {
                isCorrect = optionMap.get(response.selectedOptionId.toString()) || false
            } else if (question.type === 'TRUE_FALSE') {
                const studentAnswer = response.textResponse ?? response.selectedOptionId?.toString()
                isCorrect = studentAnswer === String(question.correctAnswer)
            }

            // Update the response with the evaluated isCorrect
            await Response.findByIdAndUpdate(response._id, { isCorrect })

            if (isCorrect) {
                earnedPoints += question.points || 1
                correctCount++
            }
        }

        const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0

        // Mettre à jour la tentative
        const now = new Date()
        await Attempt.findByIdAndUpdate(attemptId, {
            status: AttemptStatus.COMPLETED,
            submittedAt: now,
            score: earnedPoints,
            maxScore: totalPoints,
            percentage: Math.round(percentage * 10) / 10,
            timeSpent: Math.round((now.getTime() - attempt.startedAt.getTime()) / 60000)
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
            correctAnswers: correctCount
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
            // questionId peut être populé (objet) ou un ObjectId brut selon le populate
            const response = responses.find(r => {
                const qid = (r.questionId as any)?._id ?? r.questionId
                return qid?.toString() === question._id.toString()
            })
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
