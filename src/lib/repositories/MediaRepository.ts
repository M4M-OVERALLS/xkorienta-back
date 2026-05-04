import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Media, { IMedia } from '@/models/Media'
import { MediaStatus, MediaScope, MediaType } from '@/models/enums'

export interface MediaFilters {
    mediaType?: MediaType
    scope?: MediaScope
    schoolId?: string
    status?: MediaStatus
    minPrice?: number
    maxPrice?: number
    search?: string
    page?: number
    limit?: number
    /** Aperçu catalogue : champs allégés */
    catalogPreview?: boolean
}

export interface PaginatedMedia {
    items: IMedia[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export class MediaRepository {
    async findById(id: string): Promise<IMedia | null> {
        await connectDB()
        return Media.findById(id)
            .populate('submittedBy', 'name email image')
            .populate('validatedBy', 'name')
            .lean() as Promise<IMedia | null>
    }

    async findPaginated(filters: MediaFilters): Promise<PaginatedMedia> {
        await connectDB()

        const page  = Math.max(1, filters.page ?? 1)
        const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
        const skip  = (page - 1) * limit

        const query: Record<string, unknown> = {}

        if (filters.status)    query.status    = filters.status
        if (filters.scope)     query.scope     = filters.scope
        if (filters.mediaType) query.mediaType = filters.mediaType

        if (filters.schoolId) {
            query.schoolId = new mongoose.Types.ObjectId(filters.schoolId)
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {}
            if (filters.minPrice !== undefined)
                (query.price as Record<string, number>).$gte = filters.minPrice
            if (filters.maxPrice !== undefined)
                (query.price as Record<string, number>).$lte = filters.maxPrice
        }

        if (filters.search) {
            query.$text = { $search: filters.search }
        }

        const listQuery = Media.find(query)
            .populate('submittedBy', 'name image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        if (filters.catalogPreview) {
            listQuery.select(
                '_id mediaType title mimeType duration price currency playCount purchaseCount coverImageKey submittedBy createdAt seriesTitle episodeNumber seasonNumber'
            )
        }

        const [items, total] = await Promise.all([
            listQuery.lean(),
            Media.countDocuments(query),
        ])

        return {
            items: items as IMedia[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    async findByTeacher(teacherId: string, page = 1, limit = 20): Promise<PaginatedMedia> {
        await connectDB()
        const skip = (page - 1) * limit

        const query = { submittedBy: new mongoose.Types.ObjectId(teacherId) }

        const [items, total] = await Promise.all([
            Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Media.countDocuments(query),
        ])

        return { items: items as IMedia[], total, page, limit, totalPages: Math.ceil(total / limit) }
    }

    async findPending(scope?: MediaScope, schoolId?: string): Promise<IMedia[]> {
        await connectDB()

        const query: Record<string, unknown> = { status: MediaStatus.PENDING }
        if (scope)    query.scope    = scope
        if (schoolId) query.schoolId = new mongoose.Types.ObjectId(schoolId)

        return Media.find(query)
            .populate('submittedBy', 'name email image')
            .sort({ createdAt: 1 })
            .lean() as Promise<IMedia[]>
    }

    async create(data: Partial<IMedia>): Promise<IMedia> {
        await connectDB()
        return Media.create(data)
    }

    async updateById(id: string, data: Partial<IMedia>): Promise<IMedia | null> {
        await connectDB()
        return Media.findByIdAndUpdate(id, { $set: data }, { new: true }).lean() as Promise<IMedia | null>
    }

    async deleteById(id: string): Promise<void> {
        await connectDB()
        await Media.findByIdAndDelete(id)
    }

    async incrementPlayCount(id: string): Promise<void> {
        await connectDB()
        await Media.findByIdAndUpdate(id, { $inc: { playCount: 1 } })
    }

    async incrementPurchaseCount(id: string): Promise<void> {
        await connectDB()
        await Media.findByIdAndUpdate(id, { $inc: { purchaseCount: 1 } })
    }
}

export const mediaRepository = new MediaRepository()
