import { fileTypeFromBuffer } from 'file-type'
import { IBook } from '@/models/Book'
import { BookFormat, BookScope, BookStatus, UserRole, DifficultyLevel } from '@/models/enums'
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
    /** Image de couverture optionnelle (JPEG, PNG, WebP) */
    coverBuffer?: Buffer
    coverOriginalName?: string
    price: number
    currency?: string
    scope: BookScope
    schoolId?: string
    copyrightAccepted: boolean
    teacherId: string
    /** Métadonnées pédagogiques (recommandation IA) */
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
    /**
     * Platform admins (DG_M4M, TECH_SUPPORT) have super-admin powers:
     * ils peuvent valider n'importe quel livre (GLOBAL ou SCHOOL, toutes écoles).
     * SCHOOL_ADMIN reste restreint à son/ses propres école(s).
     */
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
     * Validates and stores a book file, then creates the DB record.
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

        const format = ALLOWED_MIME_TYPES[detected.mime]

        if (input.scope === BookScope.SCHOOL && !input.schoolId) {
            throw new Error('schoolId is required when scope is SCHOOL')
        }

        if (input.price < 0) {
            throw new Error('Price cannot be negative')
        }

        const storage = StorageStrategyFactory.create(config.storageProvider)
        const fileKey = await storage.upload(input.fileBuffer, input.fileOriginalName, detected.mime)

        // Sauvegarde optionnelle de l'image de couverture dans public/uploads/covers/
        let coverImageKey: string | undefined
        if (input.coverBuffer && input.coverOriginalName) {
            coverImageKey = await BookService.saveCoverImage(input.coverBuffer, input.coverOriginalName)
        }

        return bookRepository.create({
            title: input.title.trim(),
            description: input.description.trim(),
            format,
            fileKey,
            coverImageKey,
            price: input.price,
            currency: (input.currency ?? 'XAF').toUpperCase(),
            scope: input.scope,
            schoolId: input.schoolId ? new mongoose.Types.ObjectId(input.schoolId) : undefined,
            submittedBy: new mongoose.Types.ObjectId(input.teacherId),
            status: BookStatus.PENDING,
            copyrightAccepted: true,
            targetLevels: input.targetLevels?.map((id) => new mongoose.Types.ObjectId(id)),
            targetFields: input.targetFields?.map((id) => new mongoose.Types.ObjectId(id)),
            subjects: input.subjects?.map((id) => new mongoose.Types.ObjectId(id)),
            difficulty: input.difficulty,
            tags: input.tags,
        })
    }

    /**
     * Sauvegarde l'image de couverture dans public/uploads/covers/ et retourne la clé.
     * Les images de couverture sont publiques (simples miniatures).
     */
    private static async saveCoverImage(buffer: Buffer, originalName: string): Promise<string> {
        const COVERS_DIR = path.join(process.cwd(), 'public', 'uploads', 'covers')
        await mkdir(COVERS_DIR, { recursive: true })
        const ext = path.extname(originalName).toLowerCase() || '.jpg'
        const key = `${randomUUID()}${ext}`
        await writeFile(path.join(COVERS_DIR, key), buffer)
        return key
    }

    /** Construit l'URL publique d'une image de couverture. */
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

    /** Returns the public book catalogue. Only APPROVED books visible to end users. */
    static async getCatalogue(filters: Omit<BookFilters, 'status'>): Promise<PaginatedBooks> {
        return bookRepository.findPaginated({ ...filters, status: BookStatus.APPROVED })
    }

    /** Returns a single book by ID. Non-approved only visible to owner or admin. */
    static async getBookById(id: string, requesterId: string, requesterRole: UserRole): Promise<IBook> {
        const book = await bookRepository.findById(id)
        if (!book) throw new Error('Book not found')

        const submittedById = BookService.extractObjectId(book.submittedBy)
        const isOwner = submittedById === requesterId
        const isAdmin =
            requesterRole === UserRole.SCHOOL_ADMIN ||
            BookService.isPlatformAdmin(requesterRole)

        if (book.status !== BookStatus.APPROVED && !isOwner && !isAdmin) {
            throw new Error('Book not found')
        }

        return book
    }

    /** Returns a single APPROVED book for public access (no session required). */
    static async getPublicBookById(id: string): Promise<IBook> {
        const book = await bookRepository.findById(id)
        if (!book || book.status !== BookStatus.APPROVED) {
            throw new Error('Book not found')
        }
        return book
    }

    /** Updates a book. Only owner can update, only while DRAFT. */
    static async updateBook(bookId: string, requesterId: string, data: UpdateBookInput): Promise<IBook> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')
        const submittedById = BookService.extractObjectId(book.submittedBy)
        if (submittedById !== requesterId) throw new Error('Forbidden: you can only edit your own books')
        if (book.status !== BookStatus.DRAFT) throw new Error('Only books in DRAFT status can be edited')
        if (data.price !== undefined && data.price < 0) throw new Error('Price cannot be negative')

        return bookRepository.updateById(bookId, {
            ...data,
            currency: data.currency?.toUpperCase(),
        }) as Promise<IBook>
    }

    /** Deletes a book (owner only, DRAFT only). Also removes stored file. */
    static async deleteBook(bookId: string, requesterId: string): Promise<void> {
        const book = await bookRepository.findById(bookId)
        if (!book) throw new Error('Book not found')
        const submittedById = BookService.extractObjectId(book.submittedBy)
        if (submittedById !== requesterId) throw new Error('Forbidden: you can only delete your own books')
        if (book.status !== BookStatus.DRAFT) throw new Error('Only books in DRAFT status can be deleted')

        const config = await bookConfigRepository.getOrCreate()
        const storage = StorageStrategyFactory.create(config.storageProvider)
        await storage.delete(book.fileKey)
        await bookRepository.deleteById(bookId)
    }

    /** Approves a pending book submission. */
    static async approveBook(input: ValidateBookInput): Promise<IBook> {
        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== BookStatus.PENDING) throw new Error('Only PENDING books can be approved')

        BookService.checkValidationPermission(book, input)

        return bookRepository.updateById(input.bookId, {
            status: BookStatus.APPROVED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
        }) as Promise<IBook>
    }

    /** Rejects a pending book submission with a mandatory comment. */
    static async rejectBook(input: ValidateBookInput & { comment: string }): Promise<IBook> {
        if (!input.comment?.trim()) throw new Error('A rejection comment is required')

        const book = await bookRepository.findById(input.bookId)
        if (!book) throw new Error('Book not found')
        if (book.status !== BookStatus.PENDING) throw new Error('Only PENDING books can be rejected')

        BookService.checkValidationPermission(book, input)

        return bookRepository.updateById(input.bookId, {
            status: BookStatus.REJECTED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
            validationComment: input.comment.trim(),
        }) as Promise<IBook>
    }

    /** Returns books pending validation for the given admin. */
    static async getPendingBooks(adminRole: UserRole, adminSchoolIds: string[]): Promise<IBook[]> {
        if (BookService.isPlatformAdmin(adminRole)) {
            // Admin plateforme : voit tout (GLOBAL + toutes les écoles)
            return bookRepository.findPending()
        }
        if (adminRole === UserRole.SCHOOL_ADMIN && adminSchoolIds.length > 0) {
            const results = await Promise.all(
                adminSchoolIds.map((sid) => bookRepository.findPending(BookScope.SCHOOL, sid))
            )
            return results.flat()
        }
        return []
    }

    /** Returns the download URL (or file key) after access is verified. */
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
        // Admin plateforme : peut tout valider (GLOBAL ou SCHOOL, quelle que soit l'école)
        if (BookService.isPlatformAdmin(input.adminRole)) return

        if (book.scope === BookScope.GLOBAL) {
            throw new Error('Only platform administrators can validate global books')
        }

        // SCHOOL : seul le SCHOOL_ADMIN de l'école concernée peut valider
        if (input.adminRole !== UserRole.SCHOOL_ADMIN) {
            throw new Error('Only school administrators can validate school books')
        }
        if (!input.adminSchoolIds.includes(book.schoolId?.toString() ?? '')) {
            throw new Error('You can only validate books from your own school')
        }
    }
}
