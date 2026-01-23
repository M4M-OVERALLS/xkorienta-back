import Exam, { IExam } from "@/models/Exam"
import Question from "@/models/Question"
import PedagogicalProfile from "@/models/PedagogicalProfile"
import { ExamStatus, UserRole } from "@/models/enums"
import { AccessHandlerChain, AccessRequest } from "@/lib/patterns/AccessHandler"
import { publishEvent } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"
import mongoose from "mongoose"
import { ExamRepository } from "@/lib/repositories/ExamRepository"

/**
 * Service pour gérer le workflow de validation et publication des examens
 * Intègre le Chain of Responsibility pattern pour les vérifications d'accès
 */
export class ExamWorkflowService {
    /**
     * Soumet un examen pour validation
     * DRAFT → PENDING_VALIDATION
     */
    static async submitForValidation(examId: string, userId: string) {
        const exam = await Exam.findById(examId)
        if (!exam) throw new Error("Exam not found")

        // Vérifier que l'utilisateur est le créateur
        if (exam.createdById.toString() !== userId) {
            throw new Error("Unauthorized: Only the creator can submit for validation")
        }

        // Vérifier que l'examen est en DRAFT
        if (exam.status !== ExamStatus.DRAFT) {
            throw new Error(`Cannot submit exam with status ${exam.status}`)
        }

        // Vérifier que l'examen a au moins une question
        const questionCount = await Question.countDocuments({ examId: exam._id })
        if (questionCount === 0) {
            throw new Error("Cannot submit exam without questions")
        }

        // Mettre à jour le statut
        exam.status = ExamStatus.PENDING_VALIDATION
        await exam.save()

        // Publier un événement
        await publishEvent({
            type: EventType.EXAM_SUBMITTED_FOR_VALIDATION,
            data: {
                examId: exam._id,
                createdBy: userId,
                title: exam.title
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        return exam
    }

    /**
     * Valide un examen (Inspector/Teacher avec permissions)
     * PENDING_VALIDATION → VALIDATED
     */
    static async validateExam(examId: string, userId: string, userRole: UserRole) {
        const exam = await Exam.findById(examId)
            .populate('subject')
            .populate('targetLevels')
            .populate('targetFields')

        if (!exam) throw new Error("Exam not found")

        // Vérifier que l'examen est en PENDING_VALIDATION
        if (exam.status !== ExamStatus.PENDING_VALIDATION) {
            throw new Error(`Cannot validate exam with status ${exam.status}`)
        }

        // Vérifier les permissions avec AccessHandler
        const hasAccess = await this.checkValidationAccess(userId, userRole, exam)
        if (!hasAccess) {
            throw new Error("Unauthorized: You don't have permission to validate this exam")
        }

        // Mettre à jour le statut
        exam.status = ExamStatus.VALIDATED
        exam.validatedBy = new mongoose.Types.ObjectId(userId)
        exam.validatedAt = new Date()
        await exam.save()

        // Publier un événement
        await publishEvent({
            type: EventType.EXAM_VALIDATED,
            data: {
                examId: exam._id,
                validatedBy: userId,
                title: exam.title
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        return exam
    }

    /**
     * Publie un examen
     * VALIDATED → PUBLISHED
     */
    static async publishExam(examId: string, userId: string, userRole: UserRole) {
        const exam = await Exam.findById(examId)
        if (!exam) throw new Error("Exam not found")

        // Vérifier que l'examen est VALIDATED
        if (exam.status !== ExamStatus.VALIDATED) {
            throw new Error(`Cannot publish exam with status ${exam.status}`)
        }

        // Vérifier les permissions (créateur ou validateur)
        const isCreator = exam.createdById.toString() === userId
        const isValidator = exam.validatedBy?.toString() === userId
        const isInspector = userRole === UserRole.INSPECTOR

        if (!isCreator && !isValidator && !isInspector) {
            throw new Error("Unauthorized: Only creator, validator, or inspector can publish")
        }

        // Vérifier que les dates sont cohérentes
        if (exam.startTime && exam.endTime && exam.startTime >= exam.endTime) {
            throw new Error("Start time must be before end time")
        }

        // Mettre à jour le statut
        exam.status = ExamStatus.PUBLISHED
        exam.isPublished = true
        exam.publishedAt = new Date()
        await exam.save()

        // Publier un événement
        await publishEvent({
            type: EventType.EXAM_PUBLISHED,
            data: {
                examId: exam._id,
                publishedBy: userId,
                title: exam.title,
                startTime: exam.startTime,
                endTime: exam.endTime
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        return exam
    }

    /**
     * Archive un examen
     * PUBLISHED → ARCHIVED
     */
    static async archiveExam(examId: string, userId: string, userRole: UserRole) {
        const repo = new ExamRepository()
        const exam = await repo.findById(examId)
        if (!exam) throw new Error("Exam not found")

        // Vérifier que l'examen est PUBLISHED
        if (exam.status !== ExamStatus.PUBLISHED) {
            throw new Error(`Cannot archive exam with status ${exam.status}`)
        }

        // Vérifier les permissions (créateur ou admin)
        const isCreator = exam.createdById.toString() === userId
        const isAdmin = [UserRole.INSPECTOR, UserRole.PRINCIPAL, UserRole.DG_ISIMMA].includes(userRole)

        if (!isCreator && !isAdmin) {
            throw new Error("Unauthorized: Only creator or admin can archive")
        }

        // Mettre à jour le statut
        exam.status = ExamStatus.ARCHIVED
        exam.isPublished = false
        await repo.save(exam)

        // Publier un événement
        await publishEvent({
            type: EventType.EXAM_ARCHIVED,
            data: {
                examId: exam._id,
                archivedBy: userId,
                title: exam.title
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        return exam
    }

    /**
     * Vérifie si un utilisateur peut valider un examen
     * Utilise le Chain of Responsibility pattern
     */
    private static async checkValidationAccess(
        userId: string,
        userRole: UserRole,
        exam: IExam
    ): Promise<boolean> {
        // Les inspecteurs ont accès à tout
        if (userRole === UserRole.INSPECTOR) {
            return true
        }

        // Les enseignants doivent avoir les bonnes permissions
        if (userRole === UserRole.TEACHER) {
            const profile = await PedagogicalProfile.findOne({ user: userId })
            if (!profile) return false

            // Créer une requête d'accès
            const request: AccessRequest = {
                profile,
                resourceType: 'exam',
                resourceId: exam.subject as any
            }

            // Vérifier l'accès via la chaîne
            return await AccessHandlerChain.checkAccess(request)
        }

        return false
    }

    /**
     * Récupère l'historique du workflow d'un examen
     */
    static async getWorkflowHistory(examId: string) {
        const exam = await Exam.findById(examId)
            .populate('createdById', 'name email')
            .populate('validatedBy', 'name email')
            .lean()

        if (!exam) throw new Error("Exam not found")

        return {
            status: exam.status,
            isPublished: exam.isPublished,
            createdAt: exam.createdAt,
            createdBy: exam.createdById,
            validatedAt: exam.validatedAt,
            validatedBy: exam.validatedBy,
            publishedAt: exam.publishedAt,
            timeline: [
                { status: ExamStatus.DRAFT, date: exam.createdAt, user: exam.createdById },
                exam.validatedAt && { status: ExamStatus.VALIDATED, date: exam.validatedAt, user: exam.validatedBy },
                exam.publishedAt && { status: ExamStatus.PUBLISHED, date: exam.publishedAt }
            ].filter(Boolean)
        }
    }
}

