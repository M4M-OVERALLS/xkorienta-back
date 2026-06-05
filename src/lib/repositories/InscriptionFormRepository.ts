import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import InscriptionForm, { type IInscriptionForm } from '@/models/InscriptionForm'
import { InscriptionFormStatus } from '@/models/enums'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PublishedFormFilters {
    page: number
    limit: number
    search?: string
    schoolId?: string
    priceMin?: number
    priceMax?: number
}

export interface PaginatedForms {
    forms: IInscriptionForm[]
    total: number
    page: number
    limit: number
    totalPages: number
}

// ── Repository ──────────────────────────────────────────────────────────────

export class InscriptionFormRepository {
    /**
     * Creer une nouvelle fiche d'inscription (brouillon).
     */
    async create(data: Partial<IInscriptionForm>): Promise<IInscriptionForm> {
        await connectDB()
        return InscriptionForm.create(data)
    }

    /**
     * Trouver une fiche par ID avec populate de l'ecole.
     */
    async findById(id: string): Promise<IInscriptionForm | null> {
        await connectDB()
        return InscriptionForm.findById(id)
            .populate('schoolId', 'name type logoUrl city contactInfo')
            .populate('createdBy', 'name email')
            .lean()
    }

    /**
     * Liste publique des fiches publiees, paginee.
     * Utilise l'index composite { status, closesAt }.
     * Sort par deadline la plus proche (closesAt ASC).
     */
    async findPublished(filters: PublishedFormFilters): Promise<PaginatedForms> {
        await connectDB()

        const page = Math.max(1, filters.page)
        const limit = Math.min(50, Math.max(1, filters.limit))
        const skip = (page - 1) * limit
        const now = new Date()

        const query: Record<string, unknown> = {
            status: InscriptionFormStatus.PUBLISHED,
            closesAt: { $gte: now },
            opensAt: { $lte: now },
        }

        if (filters.schoolId) {
            query.schoolId = new mongoose.Types.ObjectId(filters.schoolId)
        }
        if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
            const priceFilter: Record<string, number> = {}
            if (filters.priceMin !== undefined) priceFilter.$gte = filters.priceMin
            if (filters.priceMax !== undefined) priceFilter.$lte = filters.priceMax
            query.price = priceFilter
        }
        if (filters.search) {
            query.title = { $regex: filters.search, $options: 'i' }
        }

        const [forms, total] = await Promise.all([
            InscriptionForm.find(query)
                .populate('schoolId', 'name type logoUrl city contactInfo')
                .sort({ closesAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            InscriptionForm.countDocuments(query),
        ])

        return { forms, total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Fiches d'une ecole (toutes, pour l'admin).
     * Utilise l'index composite { schoolId, status }.
     */
    async findBySchool(
        schoolId: string,
        page: number = 1,
        limit: number = 20,
        status?: InscriptionFormStatus,
    ): Promise<PaginatedForms> {
        await connectDB()

        page = Math.max(1, page)
        limit = Math.min(50, Math.max(1, limit))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {
            schoolId: new mongoose.Types.ObjectId(schoolId),
        }
        if (status) query.status = status

        const [forms, total] = await Promise.all([
            InscriptionForm.find(query)
                .populate('schoolId', 'name type logoUrl city')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            InscriptionForm.countDocuments(query),
        ])

        return { forms, total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Mettre a jour une fiche (brouillon uniquement — verifie par le service).
     */
    async update(id: string, data: Partial<IInscriptionForm>): Promise<IInscriptionForm | null> {
        await connectDB()
        return InscriptionForm.findByIdAndUpdate(id, { $set: data }, { new: true }).lean()
    }

    /**
     * Changer le statut d'une fiche (publish, close, archive).
     */
    async updateStatus(
        id: string,
        status: InscriptionFormStatus,
        extra?: Partial<IInscriptionForm>,
    ): Promise<IInscriptionForm | null> {
        await connectDB()
        return InscriptionForm.findByIdAndUpdate(
            id,
            { $set: { status, ...extra } },
            { new: true },
        ).lean()
    }

    /**
     * Incrementer le compteur de candidatures (atomique, pas de race condition).
     */
    async incrementCandidates(id: string): Promise<void> {
        await connectDB()
        await InscriptionForm.updateOne(
            { _id: id },
            { $inc: { currentCandidates: 1 } },
        )
    }

    /**
     * Decrementer le compteur de candidatures (annulation).
     */
    async decrementCandidates(id: string): Promise<void> {
        await connectDB()
        await InscriptionForm.updateOne(
            { _id: id, currentCandidates: { $gt: 0 } },
            { $inc: { currentCandidates: -1 } },
        )
    }

    /**
     * Compter les fiches par statut pour un schoolId (stats dashboard admin).
     */
    async countByStatus(schoolId: string): Promise<Record<string, number>> {
        await connectDB()
        const results = await InscriptionForm.aggregate([
            { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        const counts: Record<string, number> = {}
        for (const r of results) {
            counts[r._id as string] = r.count as number
        }
        return counts
    }
}
