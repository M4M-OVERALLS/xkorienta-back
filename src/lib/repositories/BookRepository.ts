import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Book, { IBook } from '@/models/Book'
import { BookStatus, BookScope } from '@/models/enums'

export interface BookFilters {
    scope?: BookScope
    schoolId?: string
    status?: BookStatus
    format?: string
    minPrice?: number
    maxPrice?: number
    search?: string
    page?: number
    limit?: number
    /** Liste catalogue : moins de champs (pas de description / fileKey) — plus léger sur le réseau et MongoDB */
    catalogPreview?: boolean
}

export interface PaginatedBooks {
    books: IBook[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export class BookRepository {
    async findById(id: string): Promise<IBook | null> {
        await connectDB()
        return Book.findById(id)
            .populate('submittedBy', 'name email image')
            .populate('validatedBy', 'name')
            .lean() as Promise<IBook | null>
    }

    async findPaginated(filters: BookFilters): Promise<PaginatedBooks> {
        await connectDB()

        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {}

        if (filters.status) query.status = filters.status
        if (filters.scope)  query.scope  = filters.scope
        if (filters.format) query.format = filters.format

        if (filters.schoolId) {
            query.schoolId = new mongoose.Types.ObjectId(filters.schoolId)
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {}
            if (filters.minPrice !== undefined) (query.price as Record<string, number>).$gte = filters.minPrice
            if (filters.maxPrice !== undefined) (query.price as Record<string, number>).$lte = filters.maxPrice
        }

        if (filters.search) {
            query.$text = { $search: filters.search }
        }

        const listQuery = Book.find(query)
            .populate('submittedBy', 'name image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        if (filters.catalogPreview) {
            listQuery.select(
                '_id title format price currency downloadCount purchaseCount submittedBy createdAt'
            )
        }

        const [books, total] = await Promise.all([listQuery.lean(), Book.countDocuments(query)])

        return {
            books: books as IBook[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    async findByTeacher(teacherId: string, page = 1, limit = 20): Promise<PaginatedBooks> {
        await connectDB()
        const skip = (page - 1) * limit

        const query = { submittedBy: new mongoose.Types.ObjectId(teacherId) }

        const [books, total] = await Promise.all([
            Book.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Book.countDocuments(query),
        ])

        return {
            books: books as IBook[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    async findPending(scope?: BookScope, schoolId?: string): Promise<IBook[]> {
        await connectDB()

        const query: Record<string, unknown> = { status: BookStatus.PENDING }
        if (scope)    query.scope    = scope
        if (schoolId) query.schoolId = new mongoose.Types.ObjectId(schoolId)

        return Book.find(query)
            .populate('submittedBy', 'name email image')
            .sort({ createdAt: 1 })
            .lean() as Promise<IBook[]>
    }

    async create(data: Partial<IBook>): Promise<IBook> {
        await connectDB()
        const book = await Book.create(data)
        return book
    }

    async updateById(id: string, data: Partial<IBook>): Promise<IBook | null> {
        await connectDB()
        return Book.findByIdAndUpdate(id, { $set: data }, { new: true }).lean() as Promise<IBook | null>
    }

    async deleteById(id: string): Promise<void> {
        await connectDB()
        await Book.findByIdAndDelete(id)
    }

    async incrementDownloadCount(id: string): Promise<void> {
        await connectDB()
        await Book.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } })
    }

    async incrementPurchaseCount(id: string): Promise<void> {
        await connectDB()
        await Book.findByIdAndUpdate(id, { $inc: { purchaseCount: 1 } })
    }
}

export const bookRepository = new BookRepository()
