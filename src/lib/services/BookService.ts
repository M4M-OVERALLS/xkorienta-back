import { fileTypeFromBuffer } from 'file-type'
import { IBook } from '@/models/Book'
import { BookFormat, MediaScope, MediaStatus, MediaType, UserRole, DifficultyLevel } from '@/models/enums'
import { bookRepository, BookFilters, PaginatedBooks } from '@/lib/repositories/BookRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { StorageStrategyFactory } from '@/lib/strategies/storage/StorageStrategyFactory'
import mongoose from 'mongoose'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_MIME_TYPES: Record<string, BookFormat> = {
    'application/pdf':      BookFormat.PDF,
    'application/epub+zip': BookFormat.EPUB,
}

export interface SubmitBookInput {
    title: string
    description: string
    fileBuffer: Buffer
    fileOriginalName: string
    coverBuffer?: Buffer
    coverOriginalName?: string
    price: number
    currency?: string
    scope: MediaScope
    schoolId?: string
    copyrightAccepted: boolean
    teacherId: string
    targetLevels?: string[]
    targetFields?: string[]
    subjects?: string[]
    difficulty?: DifficultyLevel
    tags?: string[]
}

export interface UpdateBookInput {
    title?: string
    description?: string
    price?: number
    currency?: string
}

export interface ValidateBookInput {
    bookId: string
    adminId: string
    adminRole: UserRole
    adminSchoolIds: string[]
}

export class BookService {
    private static isPlatformAdmin(role: UserRole): boolean {
        return role === UserRole.DG_M4M || role === UserRole.TECH_SUPPORT
    }

    private static extractObjectId(value: unknown): string | undefined {
        if (!value) return undefined
        if (typeof value === 'string') return value
        if (typeof value === 'object' && value !== null) {
            const maybeId = (value as { _id?: unknown })._id
            if (typeof maybeId === 'string') return maybeId
            if (maybeId && typeof maybeId === 'object' && 'toString' in (maybeId as object)) {
                return (maybeId as { toString: () => string }).toString()
            }
            if ('toString' in value) return (value as { toString: () => string }).toString()
        }
        return undefined
    }

    /**
     * Validates and stores a book file, then creates the Media record with mediaType=BOOK.
     * Book is immediately set to PENDING for admin review.
     */
    static async submitBook(input: SubmitBookInput): Promise<IBook> {
        if (!input.copyrightAccepted) {
            throw new Error('You must accept the copyright declaration before submitting a book')
        }

        const config = await bookConfigRepository.getOrCreate()

        if (input.fileBuffer.byteLength > config.maxFileSizeBytes) {
            const maxMB = Math.round(config.maxFileSizeBytes / (1024 * 1024))
            throw new Error(`File too large. Maximum allowed size is ${maxMB} MB`)
        }

        const detected = await fileTypeFromBuffer(input.fileBuffer)
        if (!detected || !ALLOWED_MIME_TYPES[detected.mime]) {
            throw new Error('Invalid file type. Only PDF and EPUB files are accepted')
        }

        const bookFormat = ALLOWED_MIME_TYPES[detected.mime]

        if (input.scope === MediaScope.SCHOOL && !input.schoolId) {
            throw new Error('schoolId is required when scope is SCHOOL')
        }

        if (input.price < 0) {
            throw new Error('Price cannot be negative')
        }

        const storage = StorageStrategyFactory.create(config.storageProvider)
        const fileKey = await storage.upload(input.fileBuffer, input.fileOriginalName, detected.mime)

        let coverImageKey: string | undefined
        if (input.coverBuffer && input.coverOriginalName) {
            coverImageKey = await BookService.saveCoverImage(input.coverBuffer, input.coverOriginalName)
        }

        return bookRepository.create({
            mediaType: MediaType.BOOK,
            title: input.title.trim(),
            description: input.description.trim(),
            bookFormat,
            fileKey,
            mimeType: detected.mime,
            fileSize: input.fileBuffer.byteLength,
            coverImageKey,
            price: input.price,
            currency: (input.currency ?? 'XAF').toUpperCase(),
            scope: input.scope,
            schoolId: input.schoolId ? new mongoose.Types.ObjectId(input.schoolId) : undefined,
            submittedBy: new mongoose.Types.ObjectId(input.teacherId),
            status: MediaStatus.PENDING,
            copyrightAccepted: true,
            targetLevels: input.targetLevels?.map((id) => new mongoose.Types.ObjectId(id)),
            targetFields: input.targetFields?.map((id) => new mongoose.Types.ObjectId(id)),
            subjects: input.subjects?.map((id) => new mongoose.Types.ObjectId(id)),
            difficulty: input.difficulty,
            tags: input.tags,
        })
    }

    private static async saveCoverImage(buffer: Buffer, originalName: string): Promise<string> {
        const COVERS_DIR = path.join(process.cwd(), 'public', 'uploads', 'covers')
        await mkdir(COVERS_DIR, { recursive: true })
        const ext = path.extname(originalName).toLowerCase() || '.jpg'
        const key = `${randomUUID()}${ext}`
        await writeFile(path.join(COVERS_DIR, key), buffer)
        return key
    }

    static buildCoverUrl(coverImageKey: string | undefined): string | undefined {
        if (!coverImageKey) return undefined
        const base = (
            process.env.APP_BASE_URL ||
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.NEXTAUTH_URL ||
            'http://localhost:3001'
        ).replace(/\/+$/, '')
        return `${base}/uploads/covers/${coverImageKey}`
    }

    static async getCatalogue(filters: Omit<BookFilters, 'status'>): Promise<PaginatedBooks> {
        return bookRepository.findPaginated({ ...filters, status: MediaStatus.APPROVED })
    }

    static async getBookById(id: string, requesterId: string, requesterRole: UserRole): Promise<IBook> {
        const book = await bookRepository.findById(id)
        if (!book) throw new Error('Book not found')

        const submittedById = BookService.extractObjectId(book.submittedBy)
        const isOwner = submittedById === requesterId
        const isAdmin =
            requesterRole === UserRole.SCHOOL_ADMIN ||
            BookService.isPlatformAdmin(requesterRole)

        if (book.status !== MediaStatus.APPROVED && !isOwner && !isAdmin) {
            throw new Error('Book not found')
        }

        return book
    }

    static async getPublicBookById(id: string): Promise<IBook> {
        const book = await bookRepository.findById(id)
        if (!book || book.status !== MediaStatus.APPROVED) {
            throw new Error('Book not found')
        }
        return book
    }

    static async updateBook(bookId: string, requesterId: string, data: UpdateBookInput): Promise<IBook> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')
        const submittedById = BookService.extractObjectId(book.submittedBy)
        if (submittedById !== requesterId) throw new Error('Forbidden: you can only edit your own books')
        if (book.status !== MediaStatus.DRAFT) throw new Error('Only books in DRAFT status can be edited')
        if (data.price !== undefined && data.price < 0) throw new Error('Price cannot be negative')

        return bookRepository.updateById(bookId, {
            ...data,
            currency: data.currency?.toUpperCase(),
        }) as Promise<IBook>
    }

    static async deleteBook(bookId: string, requesterId: string): Promise<void> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')
        const submittedById = BookService.extractObjectId(book.submittedBy)
        if (submittedById !== requesterId) throw new Error('Forbidden: you can only delete your own books')
        if (book.status !== MediaStatus.DRAFT) throw new Error('Only books in DRAFT status can be deleted')

        const config = await bookConfigRepository.getOrCreate()
        const storage = StorageStrategyFactory.create(config.storageProvider)
        await storage.delete(book.fileKey)
        await bookRepository.deleteById(bookId)
    }

    static async approveBook(input: ValidateBookInput): Promise<IBook> {
        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== MediaStatus.PENDING) throw new Error('Only PENDING books can be approved')

        BookService.checkValidationPermission(book, input)

        return bookRepository.updateById(input.bookId, {
            status: MediaStatus.APPROVED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
        }) as Promise<IBook>
    }

    static async rejectBook(input: ValidateBookInput & { comment: string }): Promise<IBook> {
        if (!input.comment?.trim()) throw new Error('A rejection comment is required')

        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== MediaStatus.PENDING) throw new Error('Only PENDING books can be rejected')

        BookService.checkValidationPermission(book, input)

        return bookRepository.updateById(input.bookId, {
            status: MediaStatus.REJECTED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
            validationComment: input.comment.trim(),
        }) as Promise<IBook>
    }

    static async getPendingBooks(adminRole: UserRole, adminSchoolIds: string[]): Promise<IBook[]> {
        if (BookService.isPlatformAdmin(adminRole)) {
            return bookRepository.findPending()
        }
        if (adminRole === UserRole.SCHOOL_ADMIN && adminSchoolIds.length > 0) {
            const results = await Promise.all(
                adminSchoolIds.map((sid) => bookRepository.findPending(MediaScope.SCHOOL, sid))
            )
            return results.flat()
        }
        return []
    }

    static async getDownloadUrl(bookId: string): Promise<string> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')

        const config = await bookConfigRepository.getOrCreate()
        const storage = StorageStrategyFactory.create(config.storageProvider)
        await bookRepository.incrementDownloadCount(bookId)

        return storage.getDownloadUrl(book.fileKey)
    }

    static async getTeacherBooks(teacherId: string, page = 1, limit = 20): Promise<PaginatedBooks> {
        return bookRepository.findByTeacher(teacherId, page, limit)
    }

    private static checkValidationPermission(book: IBook, input: ValidateBookInput): void {
        if (BookService.isPlatformAdmin(input.adminRole)) return

        if (book.scope === MediaScope.GLOBAL) {
            throw new Error('Only platform administrators can validate global books')
        }

        if (input.adminRole !== UserRole.SCHOOL_ADMIN) {
            throw new Error('Only school administrators can validate school books')
        }
        if (!input.adminSchoolIds.includes(book.schoolId?.toString() ?? '')) {
            throw new Error('You can only validate books from your own school')
        }
    }
}
