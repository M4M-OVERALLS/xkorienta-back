import { BookService } from '@/lib/services/BookService'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { StorageStrategyFactory } from '@/lib/strategies/storage/StorageStrategyFactory'
import { BookFormat, BookScope, BookStatus, UserRole, StorageProvider, PaymentProvider } from '@/models/enums'

jest.mock('@/lib/repositories/BookRepository')
jest.mock('@/lib/repositories/BookConfigRepository')
jest.mock('@/lib/strategies/storage/StorageStrategyFactory')
jest.mock('file-type', () => ({
    fileTypeFromBuffer: jest.fn(),
}))

import { fileTypeFromBuffer } from 'file-type'

const mockRepo     = bookRepository as jest.Mocked<typeof bookRepository>
const mockConfig   = bookConfigRepository as jest.Mocked<typeof bookConfigRepository>
const mockFactory  = StorageStrategyFactory as jest.Mocked<typeof StorageStrategyFactory>
const mockDetect   = fileTypeFromBuffer as jest.MockedFunction<typeof fileTypeFromBuffer>

const config = {
    commissionRate: 5,
    storageProvider: StorageProvider.LOCAL,
    paymentProvider: PaymentProvider.NOTCHPAY,
    discountRules: [],
    maxFileSizeBytes: 50 * 1024 * 1024,
}

const mockStorage = {
    upload: jest.fn().mockResolvedValue('books/test-uuid.pdf'),
    delete: jest.fn().mockResolvedValue(undefined),
    getDownloadUrl: jest.fn().mockResolvedValue('books/test-uuid.pdf'),
}

const mockBook = {
    _id: 'book123',
    title: 'Test Book',
    description: 'A great book',
    format: BookFormat.PDF,
    fileKey: 'books/test-uuid.pdf',
    price: 2000,
    currency: 'XAF',
    scope: BookScope.GLOBAL,
    submittedBy: { toString: () => 'teacher1' },
    status: BookStatus.PENDING,
    copyrightAccepted: true,
    downloadCount: 0,
    purchaseCount: 0,
}

describe('BookService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockConfig.getOrCreate.mockResolvedValue(config as any)
        mockFactory.create = jest.fn().mockReturnValue(mockStorage)
        mockDetect.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' } as any)
    })

    describe('submitBook', () => {
        const validInput = {
            title: 'My Book',
            description: 'Great content',
            fileBuffer: Buffer.from('fake-pdf-content'),
            fileOriginalName: 'book.pdf',
            price: 2000,
            currency: 'XAF',
            scope: BookScope.GLOBAL,
            copyrightAccepted: true,
            teacherId: 'teacher1',
        }

        it('should create a book with PENDING status', async () => {
            mockRepo.create.mockResolvedValue(mockBook as any)

            const result = await BookService.submitBook(validInput)

            expect(mockStorage.upload).toHaveBeenCalledWith(
                validInput.fileBuffer,
                validInput.fileOriginalName,
                'application/pdf'
            )
            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ status: BookStatus.PENDING, copyrightAccepted: true })
            )
            expect(result).toEqual(mockBook)
        })

        it('should throw when copyright is not accepted', async () => {
            await expect(BookService.submitBook({ ...validInput, copyrightAccepted: false }))
                .rejects.toThrow('copyright declaration')
        })

        it('should throw when file is too large', async () => {
            const largeBuffer = Buffer.alloc(config.maxFileSizeBytes + 1)
            await expect(BookService.submitBook({ ...validInput, fileBuffer: largeBuffer }))
                .rejects.toThrow('File too large')
        })

        it('should throw when file type is invalid', async () => {
            mockDetect.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' } as any)
            await expect(BookService.submitBook(validInput))
                .rejects.toThrow('Invalid file type')
        })

        it('should throw when scope is SCHOOL but schoolId is missing', async () => {
            await expect(BookService.submitBook({ ...validInput, scope: BookScope.SCHOOL }))
                .rejects.toThrow('schoolId is required')
        })

        it('should throw when price is negative', async () => {
            await expect(BookService.submitBook({ ...validInput, price: -100 }))
                .rejects.toThrow('Price cannot be negative')
        })

        it('should accept EPUB files', async () => {
            mockDetect.mockResolvedValue({ mime: 'application/epub+zip', ext: 'epub' } as any)
            mockRepo.create.mockResolvedValue({ ...mockBook, format: BookFormat.EPUB } as any)

            const result = await BookService.submitBook({ ...validInput, fileOriginalName: 'book.epub' })
            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ format: BookFormat.EPUB })
            )
        })
    })

    describe('approveBook', () => {
        it('should approve a pending global book as DG_M4M', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, scope: BookScope.GLOBAL } as any)
            mockRepo.updateById.mockResolvedValue({ ...mockBook, status: BookStatus.APPROVED } as any)

            await BookService.approveBook({
                bookId: 'book123',
                adminId: 'admin1',
                adminRole: UserRole.DG_M4M,
                adminSchoolIds: [],
            })

            expect(mockRepo.updateById).toHaveBeenCalledWith(
                'book123',
                expect.objectContaining({ status: BookStatus.APPROVED })
            )
        })

        it('should throw when SCHOOL_ADMIN tries to approve a global book', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, scope: BookScope.GLOBAL } as any)

            await expect(BookService.approveBook({
                bookId: 'book123',
                adminId: 'admin1',
                adminRole: UserRole.SCHOOL_ADMIN,
                adminSchoolIds: ['school1'],
            })).rejects.toThrow('Only platform administrators can validate global books')
        })

        it('should throw when SCHOOL_ADMIN approves book from a different school', async () => {
            mockRepo.findById.mockResolvedValue({
                ...mockBook,
                scope: BookScope.SCHOOL,
                schoolId: { toString: () => 'school2' },
            } as any)

            await expect(BookService.approveBook({
                bookId: 'book123',
                adminId: 'admin1',
                adminRole: UserRole.SCHOOL_ADMIN,
                adminSchoolIds: ['school1'],
            })).rejects.toThrow('You can only validate books from your own school')
        })

        it('should throw when book is not PENDING', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, status: BookStatus.APPROVED } as any)

            await expect(BookService.approveBook({
                bookId: 'book123', adminId: 'admin1', adminRole: UserRole.DG_M4M, adminSchoolIds: [],
            })).rejects.toThrow('Only PENDING books can be approved')
        })
    })

    describe('rejectBook', () => {
        it('should reject a pending book with a comment', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, scope: BookScope.GLOBAL } as any)
            mockRepo.updateById.mockResolvedValue({ ...mockBook, status: BookStatus.REJECTED } as any)

            await BookService.rejectBook({
                bookId: 'book123', adminId: 'admin1', adminRole: UserRole.DG_M4M,
                adminSchoolIds: [], comment: 'Content does not meet standards',
            })

            expect(mockRepo.updateById).toHaveBeenCalledWith(
                'book123',
                expect.objectContaining({
                    status: BookStatus.REJECTED,
                    validationComment: 'Content does not meet standards',
                })
            )
        })

        it('should throw when comment is missing', async () => {
            await expect(BookService.rejectBook({
                bookId: 'book123', adminId: 'admin1', adminRole: UserRole.DG_M4M,
                adminSchoolIds: [], comment: '',
            })).rejects.toThrow('rejection comment is required')
        })
    })

    describe('deleteBook', () => {
        it('should delete a DRAFT book and remove the file', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, status: BookStatus.DRAFT } as any)

            await BookService.deleteBook('book123', 'teacher1')

            expect(mockStorage.delete).toHaveBeenCalledWith(mockBook.fileKey)
            expect(mockRepo.deleteById).toHaveBeenCalledWith('book123')
        })

        it('should throw when user is not the owner', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, status: BookStatus.DRAFT } as any)

            await expect(BookService.deleteBook('book123', 'other-teacher'))
                .rejects.toThrow('Forbidden')
        })

        it('should throw when book is not in DRAFT status', async () => {
            mockRepo.findById.mockResolvedValue({ ...mockBook, status: BookStatus.APPROVED } as any)

            await expect(BookService.deleteBook('book123', 'teacher1'))
                .rejects.toThrow('Only books in DRAFT status can be deleted')
        })
    })

    describe('security — SQL injection-style input handling', () => {
        it('should not crash on malicious title input', async () => {
            mockDetect.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' } as any)
            mockRepo.create.mockResolvedValue(mockBook as any)

            const maliciousTitle = "'; DROP TABLE books; --"
            await BookService.submitBook({
                title: maliciousTitle,
                description: 'desc',
                fileBuffer: Buffer.from('pdf'),
                fileOriginalName: 'test.pdf',
                price: 0,
                scope: BookScope.GLOBAL,
                copyrightAccepted: true,
                teacherId: 'teacher1',
            })

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ title: maliciousTitle.trim() })
            )
        })
    })
})
