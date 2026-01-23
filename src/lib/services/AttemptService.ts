import Attempt, { IAttempt, AttemptStatus, AntiCheatEventType } from "@/models/Attempt"
import Response from "@/models/Response"
import Exam from "@/models/Exam"
import Question from "@/models/Question"
import Option from "@/models/Option"
import LearnerProfile from "@/models/LearnerProfile"
import { EvaluationStrategyFactory } from "@/lib/patterns/EvaluationStrategy"
import { publishEvent } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"
import mongoose from "mongoose"
import crypto from "crypto"

/**
 * Service pour gérer les tentatives d'examen et les réponses
 * Intègre EvaluationStrategy et Observer patterns
 */
export class AttemptService {
    /**
     * Démarre une nouvelle tentative d'examen
     */
    static async startAttempt(examId: string, userId: string) {
        const exam = await Exam.findById(examId)
        if (!exam) throw new Error("Exam not found")

        // Vérifier que l'examen est publié
        if (!exam.isPublished || exam.status !== 'PUBLISHED') {
            throw new Error("Exam is not published")
        }

        // Vérifier les dates
        const now = new Date()
        if (exam.startTime && now < exam.startTime) {
            throw new Error("Exam has not started yet")
        }
        if (exam.endTime && now > exam.endTime) {
            throw new Error("Exam has ended")
        }

        // Vérifier le nombre maximum de tentatives
        if (exam.config.maxAttempts) {
            const attemptCount = await Attempt.countDocuments({
                examId: exam._id,
                userId: new mongoose.Types.ObjectId(userId),
                status: { $in: [AttemptStatus.COMPLETED, AttemptStatus.STARTED] }
            })

            if (attemptCount >= exam.config.maxAttempts) {
                throw new Error(`Maximum attempts (${exam.config.maxAttempts}) reached`)
            }
        }

        // Vérifier le délai entre les tentatives
        if (exam.config.timeBetweenAttempts) {
            const lastAttempt = await Attempt.findOne({
                examId: exam._id,
                userId: new mongoose.Types.ObjectId(userId),
                status: AttemptStatus.COMPLETED
            }).sort({ submittedAt: -1 })

            if (lastAttempt && lastAttempt.submittedAt) {
                const hoursSinceLastAttempt =
                    (now.getTime() - lastAttempt.submittedAt.getTime()) / (1000 * 60 * 60)

                if (hoursSinceLastAttempt < exam.config.timeBetweenAttempts) {
                    const hoursRemaining = Math.ceil(exam.config.timeBetweenAttempts - hoursSinceLastAttempt)
                    throw new Error(`Please wait ${hoursRemaining} hours before attempting again`)
                }
            }
        }

        // Générer un token de reprise sécurisé
        const resumeToken = crypto.randomBytes(32).toString('hex')

        // Créer la tentative
        const attempt = await Attempt.create({
            examId: exam._id,
            userId: new mongoose.Types.ObjectId(userId),
            status: AttemptStatus.STARTED,
            startedAt: now,
            expiresAt: exam.endTime || new Date(now.getTime() + (exam.duration || 60) * 60 * 1000),
            resumeToken,
            antiCheatEvents: [],
            tabSwitchCount: 0,
            suspiciousActivityDetected: false
        })

        // Publier un événement
        await publishEvent({
            type: EventType.ATTEMPT_STARTED,
            data: {
                attemptId: attempt._id,
                examId: exam._id,
                examTitle: exam.title
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: now
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
            duration: exam.duration
        }
    }

    /**
     * Récupère les détails d'une tentative
     */
    static async getAttempt(attemptId: string, userId: string) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const repo = new AttemptRepository();
        const attempt = await repo.findById(attemptId);

        if (!attempt) throw new Error("Attempt not found")

        // Vérifier que l'utilisateur est le propriétaire
        if (attempt.userId.toString() !== userId) {
            throw new Error("Unauthorized: Not your attempt")
        }

        return attempt
    }

    /**
     * Reprend une tentative avec le token
     */
    static async resumeAttempt(attemptId: string, resumeToken: string, userId: string) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const repo = new AttemptRepository();
        const attempt = await repo.findById(attemptId); // Use findById since we just need data, not update

        if (!attempt) throw new Error("Attempt not found")

        // Vérifier le token
        if (attempt.resumeToken !== resumeToken) {
            throw new Error("Invalid resume token")
        }

        // Vérifier que l'utilisateur est le propriétaire
        if (attempt.userId.toString() !== userId) {
            throw new Error("Unauthorized: Not your attempt")
        }

        // Vérifier que la tentative est toujours en cours
        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt is not in progress")
        }

        // Récupérer les réponses déjà soumises
        // We might want to move this to ResponseRepository eventually too, but for now stick to direct model or existing pattern
        const responses = await Response.find({ attemptId: attempt._id }).lean()

        return {
            attempt,
            responses
        }
    }

    /**
     * Get redirect URL for resume token
     * Validates token and user session, returns redirect URL
     */
    static async getResumeRedirectUrl(token: string, currentUserId?: string) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const repo = new AttemptRepository();
        const attempt = await repo.findByResumeToken(token);

        if (!attempt) {
            throw new Error("Invalid token");
        }

        // If user is logged in, check if it's the right user
        if (currentUserId && attempt.userId.toString() !== currentUserId) {
            throw new Error("Logged in as wrong user. Please logout first.");
        }

        return {
            redirectUrl: `/student/exam/${attempt.examId.toString()}/take`
        };
    }

    /**
     * Enregistre un événement anti-triche
     */
    static async recordAntiCheatEvent(
        attemptId: string,
        userId: string,
        eventType: AntiCheatEventType,
        eventData?: any
    ) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const repo = new AttemptRepository();

        // Use findByIdForUpdate to get a mongoose document we can modify and save
        const attempt = await repo.findByIdForUpdate(attemptId);

        if (!attempt) throw new Error("Attempt not found")

        // Vérifier que l'utilisateur est le propriétaire
        if (attempt.userId.toString() !== userId) {
            throw new Error("Unauthorized: Not your attempt")
        }

        // Vérifier que la tentative est en cours
        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt is not in progress")
        }

        // Ajouter l'événement
        const event = {
            type: eventType,
            timestamp: new Date(),
            metadata: eventData
        }

        attempt.antiCheatEvents.push(event)

        // Vérifier les violations critiques
        // Note: We need exam config here. 
        // We could fetch exam separately or ensure populate works on findByIdForUpdate if needed.
        // But Attempt model has examId.
        const exam = await Exam.findById(attempt.examId)

        if (exam && exam.config.antiCheat.maxTabSwitches) {
            const tabSwitchCount = attempt.antiCheatEvents.filter(
                (e: any) => e.type === AntiCheatEventType.TAB_SWITCH
            ).length

            if (tabSwitchCount > exam.config.antiCheat.maxTabSwitches) {
                // Auto-soumettre la tentative
                attempt.status = AttemptStatus.ABANDONED
                attempt.submittedAt = new Date()
                await repo.save(attempt); // Use repo save wrapper

                throw new Error("Maximum tab switches exceeded. Attempt has been abandoned.")
            }
        }

        await repo.save(attempt);

        return { success: true, event }
    }

    /**
     * Soumet une tentative et l'évalue
     */
    static async submitAttempt(
        attemptId: string,
        userId: string,
        responses: Array<{
            questionId: string
            selectedOptionId?: string
            textAnswer?: string
            timeSpent?: number
        }>
    ) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const repo = new AttemptRepository();

        // Use findByIdForUpdate to work with the mongoose document
        const attempt = await repo.findByIdForUpdate(attemptId);

        if (!attempt) throw new Error("Attempt not found")

        // Vérifier que l'utilisateur est le propriétaire
        if (attempt.userId.toString() !== userId) {
            throw new Error("Unauthorized: Not your attempt")
        }

        // Vérifier que la tentative est en cours
        if (attempt.status !== AttemptStatus.STARTED) {
            throw new Error("Attempt is not in progress")
        }

        const exam = await Exam.findById(attempt.examId)
        if (!exam) throw new Error("Exam not found")

        // Récupérer toutes les questions
        const questions = await Question.find({ examId: exam._id }).lean()
        const questionIds = questions.map(q => q._id)

        // Récupérer toutes les options pour ces questions
        const allOptions = await Option.find({ questionId: { $in: questionIds } }).lean()

        // Sauvegarder les réponses
        const savedResponses: any[] = []
        for (const resp of responses) {
            const question = questions.find(q => q._id.toString() === resp.questionId)
            if (!question) continue

            // Déterminer si la réponse est correcte
            let isCorrect = false
            if (resp.selectedOptionId) {
                // Trouver l'option sélectionnée
                const selectedOption = allOptions.find(opt =>
                    opt._id.toString() === resp.selectedOptionId &&
                    opt.questionId.toString() === resp.questionId
                )
                isCorrect = selectedOption?.isCorrect || false
            }

            const response = await Response.create({
                attemptId: attempt._id,
                questionId: new mongoose.Types.ObjectId(resp.questionId),
                selectedOptionId: resp.selectedOptionId ? new mongoose.Types.ObjectId(resp.selectedOptionId) : undefined,
                isCorrect,
                timeSpent: resp.timeSpent || 0,
                answeredAt: new Date()
            })

            savedResponses.push(response)
        }

        // Évaluer avec la stratégie appropriée
        const evaluation = await EvaluationStrategyFactory.evaluateExam(
            exam,
            savedResponses,
            questions
        )

        // Calculer le temps total
        const timeSpent = Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000)

        // Mettre à jour la tentative
        attempt.status = AttemptStatus.COMPLETED
        attempt.submittedAt = new Date()
        attempt.score = evaluation.score
        attempt.maxScore = evaluation.maxScore
        attempt.percentage = evaluation.percentage
        attempt.passed = evaluation.passed
        attempt.timeSpent = timeSpent
        await attempt.save()

        // Publier un événement de soumission
        await publishEvent({
            type: EventType.ATTEMPT_SUBMITTED,
            data: {
                attemptId: attempt._id,
                examId: exam._id,
                score: evaluation.score,
                maxScore: evaluation.maxScore,
                percentage: evaluation.percentage,
                passed: evaluation.passed
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        // Publier un événement de notation (déclenche les observers)
        await publishEvent({
            type: EventType.ATTEMPT_GRADED,
            data: {
                attemptId: attempt._id,
                examId: exam._id,
                score: evaluation.score,
                percentage: evaluation.percentage,
                passed: evaluation.passed
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        // Publier un événement d'examen complété (pour gamification)
        await publishEvent({
            type: EventType.EXAM_COMPLETED,
            data: {
                examId: exam._id,
                attemptId: attempt._id,
                score: evaluation.score,
                maxScore: evaluation.maxScore,
                percentage: evaluation.percentage,
                passed: evaluation.passed,
                timeSpent
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        // Mettre à jour les stats de l'examen
        await this.updateExamStats(exam._id.toString(), evaluation)

        // Mettre à jour le profil de l'apprenant
        await this.updateLearnerStats(userId, evaluation, exam)

        return {
            attempt,
            evaluation,
            responses: savedResponses
        }
    }

    static async saveAnswer(
        attemptId: string,
        userId: string,
        questionId: string,
        selectedOptionId?: string,
        textResponse?: string
    ) {
        const { AttemptRepository } = await import("@/lib/repositories/AttemptRepository");
        const { ResponseRepository } = await import("@/lib/repositories/ResponseRepository");

        const attemptRepo = new AttemptRepository();
        const responseRepo = new ResponseRepository();

        const attempt = await attemptRepo.findById(attemptId);

        if (!attempt || attempt.userId.toString() !== userId) {
            throw new Error("Invalid attempt");
        }

        if (attempt.status === AttemptStatus.COMPLETED) {
            throw new Error("Attempt already completed");
        }

        let isCorrect = false;
        // Check if the selected option is correct (if provided)
        if (selectedOptionId) {
            const option = await Option.findById(selectedOptionId);
            isCorrect = option?.isCorrect || false;
        } else if (textResponse) {
            // Open questions are pending grading, so defaults to false or could be handled by AI later
            isCorrect = false;
        }

        // Find existing response for this question in this attempt
        const existingResponse = await responseRepo.findByAttemptAndQuestion(attemptId, questionId);

        // Update existing response or create new one
        if (existingResponse) {
            await responseRepo.update(existingResponse._id.toString(), { // Convert to string if repo expects string or handle ObjectId
                selectedOptionId: selectedOptionId ? new mongoose.Types.ObjectId(selectedOptionId) : undefined,
                textResponse: textResponse || undefined,
                isCorrect
            } as any);
        } else {
            await responseRepo.create({
                attemptId: new mongoose.Types.ObjectId(attemptId),
                questionId: new mongoose.Types.ObjectId(questionId),
                selectedOptionId: selectedOptionId ? new mongoose.Types.ObjectId(selectedOptionId) : undefined,
                textResponse: textResponse || undefined,
                isCorrect,
            } as any);
        }

        return { message: "Saved" };
    }

    /**
     * Met à jour les statistiques de l'examen
     */
    private static async updateExamStats(examId: string, evaluation: any) {
        const exam = await Exam.findById(examId)
        if (!exam) return

        const totalCompletions = exam.stats.totalCompletions + 1
        const currentAverage = exam.stats.averageScore
        const newAverage = ((currentAverage * (totalCompletions - 1)) + evaluation.percentage) / totalCompletions

        const passCount = await Attempt.countDocuments({
            examId: exam._id,
            status: AttemptStatus.COMPLETED,
            passed: true
        })
        const passRate = (passCount / totalCompletions) * 100

        await Exam.findByIdAndUpdate(examId, {
            $set: {
                'stats.totalCompletions': totalCompletions,
                'stats.averageScore': Math.round(newAverage * 100) / 100,
                'stats.passRate': Math.round(passRate * 100) / 100,
                'stats.lastAttemptDate': new Date()
            }
        })
    }

    /**
     * Met à jour les statistiques du profil apprenant
     */
    private static async updateLearnerStats(userId: string, evaluation: any, exam: any) {
        const profile = await LearnerProfile.findOne({ user: userId })
        if (!profile) return

        const totalExams = profile.stats.totalExamsTaken + 1
        const currentAverage = profile.stats.averageScore
        const newAverage = ((currentAverage * (totalExams - 1)) + evaluation.percentage) / totalExams

        await LearnerProfile.findOneAndUpdate(
            { user: userId },
            {
                $inc: { 'stats.totalExamsTaken': 1 },
                $set: {
                    'stats.averageScore': Math.round(newAverage * 100) / 100,
                    'stats.lastActivityDate': new Date()
                }
            }
        )
    }
}
