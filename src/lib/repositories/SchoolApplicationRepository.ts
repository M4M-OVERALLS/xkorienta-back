import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import SchoolApplication, { type ISchoolApplication } from '@/models/SchoolApplication'
import { ApplicationStatus } from '@/models/enums'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ApplicationFilters {
    page: number
    limit: number
    appStatus?: ApplicationStatus
}

export interface PaginatedApplications {
    applications: ISchoolApplication[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export interface ReviewData {
    reviewedBy: string
    reviewNote?: string
}

// ── Repository ──────────────────────────────────────────────────────────────

export class SchoolApplicationRepository {
    /**
     * Creer une candidature.
     */
    async create(data: Partial<ISchoolApplication>): Promise<ISchoolApplication> {
        await connectDB()
        return SchoolApplication.create(data)
    }

    /**
     * Trouver une candidature par ID avec populate.
     */
    async findById(id: string): Promise<ISchoolApplication | null> {
        await connectDB()
        return SchoolApplication.findById(id)
            .populate('inscriptionFormId', 'title price schoolId status closesAt')
            .populate('schoolId', 'name type logoUrl city')
            .populate('userId', 'name email phone')
            .lean()
    }

    /**
     * Candidatures d'une fiche (admin).
     * Utilise l'index composite { inscriptionFormId, appStatus }.
     */
    async findByForm(
        formId: string,
        filters: ApplicationFilters,
    ): Promise<PaginatedApplications> {
        await connectDB()

        const page = Math.max(1, filters.page)
        const limit = Math.min(50, Math.max(1, filters.limit))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {
            inscriptionFormId: new mongoose.Types.ObjectId(formId),
        }
        if (filters.appStatus) query.appStatus = filters.appStatus

        const [applications, total] = await Promise.all([
            SchoolApplication.find(query)
                .populate('userId', 'name email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SchoolApplication.countDocuments(query),
        ])

        return { applications, total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Candidatures d'un etudiant connecte.
     * Utilise l'index composite { userId, appStatus }.
     */
    async findByUser(
        userId: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<PaginatedApplications> {
        await connectDB()

        page = Math.max(1, page)
        limit = Math.min(50, Math.max(1, limit))
        const skip = (page - 1) * limit

        const query = { userId: new mongoose.Types.ObjectId(userId) }

        const [applications, total] = await Promise.all([
            SchoolApplication.find(query)
                .populate('inscriptionFormId', 'title price schoolId closesAt')
                .populate('schoolId', 'name type logoUrl city')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SchoolApplication.countDocuments(query),
        ])

        return { applications, total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Trouver les candidatures orphelines (anonymes) par email.
     * Utilise l'index sparse { guestEmail }.
     */
    async findByGuestEmail(email: string): Promise<ISchoolApplication[]> {
        await connectDB()
        return SchoolApplication.find({ guestEmail: email.toLowerCase() }).lean()
    }

    /**
     * Verifier si un user a deja candidate a une fiche (anti-doublon).
     * Utilise l'index unique partiel { inscriptionFormId, userId }.
     * Retourne un boolean sans charger le document (perf).
     */
    async existsByFormAndUser(formId: string, userId: string): Promise<boolean> {
        await connectDB()
        const count = await SchoolApplication.countDocuments({
            inscriptionFormId: new mongoose.Types.ObjectId(formId),
            userId: new mongoose.Types.ObjectId(userId),
            appStatus: { $nin: [ApplicationStatus.CANCELLED, ApplicationStatus.REJECTED] },
        })
        return count > 0
    }

    /**
     * Mettre a jour le statut d'une candidature (state machine).
     */
    async updateStatus(
        id: string,
        appStatus: ApplicationStatus,
        reviewData?: ReviewData,
    ): Promise<ISchoolApplication | null> {
        await connectDB()

        const update: Record<string, unknown> = { appStatus }

        if (reviewData) {
            update.reviewedBy = new mongoose.Types.ObjectId(reviewData.reviewedBy)
            update.reviewedAt = new Date()
            if (reviewData.reviewNote) update.reviewNote = reviewData.reviewNote
        }

        if (appStatus === ApplicationStatus.SUBMITTED) {
            update.submittedAt = new Date()
        } else if (appStatus === ApplicationStatus.PAID) {
            update.paidAt = new Date()
        }

        return SchoolApplication.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true },
        ).lean()
    }

    /**
     * Mettre a jour les donnees de paiement apres webhook.
     */
    async updatePayment(
        id: string,
        paymentData: {
            paymentStatus: string
            paymentRef?: string
            transactionId?: string
            invoiceId?: string
        },
    ): Promise<ISchoolApplication | null> {
        await connectDB()

        const update: Record<string, unknown> = {
            paymentStatus: paymentData.paymentStatus,
        }
        if (paymentData.paymentRef) update.paymentRef = paymentData.paymentRef
        if (paymentData.transactionId) {
            update.transactionId = new mongoose.Types.ObjectId(paymentData.transactionId)
        }
        if (paymentData.invoiceId) {
            update.invoiceId = new mongoose.Types.ObjectId(paymentData.invoiceId)
        }

        return SchoolApplication.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true },
        ).lean()
    }

    /**
     * Lier les candidatures anonymes a un compte (email matching).
     */
    async linkGuestApplications(email: string, userId: string): Promise<number> {
        await connectDB()
        const result = await SchoolApplication.updateMany(
            { guestEmail: email.toLowerCase(), userId: null },
            { $set: { userId: new mongoose.Types.ObjectId(userId) }, $unset: { guestEmail: 1 } },
        )
        return result.modifiedCount
    }

    /**
     * Compter les candidatures par statut pour une fiche (stats admin).
     */
    async countByStatusForForm(formId: string): Promise<Record<string, number>> {
        await connectDB()
        const results = await SchoolApplication.aggregate([
            { $match: { inscriptionFormId: new mongoose.Types.ObjectId(formId) } },
            { $group: { _id: '$appStatus', count: { $sum: 1 } } },
        ])
        const counts: Record<string, number> = {}
        for (const r of results) {
            counts[r._id as string] = r.count as number
        }
        return counts
    }
}
