/**
 * TDD Tests — FileExtractionService
 *
 * Teste l'extraction de texte depuis PDF, DOCX et images.
 * Ces tests doivent ECHOUER avant l'implementation (phase rouge).
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { FileExtractionService } from '@/lib/services/FileExtractionService'

// Mock pdf-parse
jest.mock('pdf-parse', () => {
    return jest.fn()
})

// Mock mammoth
jest.mock('mammoth', () => ({
    extractRawText: jest.fn(),
}))

// Buffers avec les bons magic bytes pour passer la validation
const PDF_MAGIC = Buffer.from('%PDF-1.4 fake content')
const DOCX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]) // PK ZIP
const DOC_MAGIC = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) // Compound
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

describe('FileExtractionService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // =========================================
    // VALIDATION DU FICHIER
    // =========================================

    describe('validateFile', () => {
        it('devrait accepter un fichier .pdf valide', () => {
            const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait accepter un fichier .docx valide', () => {
            const file = new File(['dummy'], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait accepter un fichier .jpg valide', () => {
            const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait accepter un fichier .jpeg valide', () => {
            const file = new File(['dummy'], 'photo.jpeg', { type: 'image/jpeg' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait accepter un fichier .png valide', () => {
            const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait rejeter un format non supporte (.xlsx)', () => {
            const file = new File(['dummy'], 'test.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un format non supporte (.pptx)', () => {
            const file = new File(['dummy'], 'test.pptx', {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un fichier executabe (.exe renomme en .pdf)', () => {
            const file = new File(['dummy'], 'malware.exe', {
                type: 'application/x-msdownload',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un fichier depassant 20 MB', () => {
            // Cree un buffer de 21 MB
            const size = 21 * 1024 * 1024
            const buffer = new ArrayBuffer(size)
            const file = new File([buffer], 'big.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'File exceeds the 20 MB limit.'
            )
        })

        it('devrait accepter un fichier de exactement 20 MB', () => {
            const size = 20 * 1024 * 1024
            const buffer = new ArrayBuffer(size)
            const file = new File([buffer], 'ok.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait rejeter un fichier vide (0 octets)', () => {
            const file = new File([], 'empty.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).toThrow()
        })
    })

    // =========================================
    // EXTRACTION PDF
    // =========================================

    describe('extractText — PDF', () => {
        it('devrait extraire le texte d\'un PDF avec couche texte', async () => {
            const pdfParse = require('pdf-parse')
            pdfParse.mockResolvedValue({ text: 'Chapitre 1 : Introduction au civisme' })

            const file = new File([PDF_MAGIC], 'syllabus.pdf', { type: 'application/pdf' })

            const result = await FileExtractionService.extractText(file)

            expect(result.text).toBe('Chapitre 1 : Introduction au civisme')
            expect(result.type).toBe('pdf')
            expect(pdfParse).toHaveBeenCalled()
        })

        it('devrait retourner un texte vide si le PDF n\'a pas de couche texte', async () => {
            const pdfParse = require('pdf-parse')
            pdfParse.mockResolvedValue({ text: '' })

            const file = new File([PDF_MAGIC], 'scan.pdf', { type: 'application/pdf' })

            const result = await FileExtractionService.extractText(file)

            expect(result.text).toBe('')
            expect(result.type).toBe('pdf')
        })

        it('devrait propager l\'erreur si pdf-parse echoue', async () => {
            const pdfParse = require('pdf-parse')
            pdfParse.mockRejectedValue(new Error('Invalid PDF'))

            const file = new File([PDF_MAGIC], 'bad.pdf', { type: 'application/pdf' })

            await expect(FileExtractionService.extractText(file)).rejects.toThrow('Invalid PDF')
        })

        it('devrait rejeter un fichier avec de mauvais magic bytes', async () => {
            const fakeBuffer = Buffer.from('NOT-A-PDF')
            const file = new File([fakeBuffer], 'fake.pdf', { type: 'application/pdf' })

            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })
    })

    // =========================================
    // EXTRACTION DOCX
    // =========================================

    describe('extractText — DOCX', () => {
        it('devrait extraire le texte brut d\'un fichier DOCX', async () => {
            const mammoth = require('mammoth')
            mammoth.extractRawText.mockResolvedValue({
                value: 'PHI 631 — Civisme et ethique\n\nChapitre 1 : Notion de civisme',
            })

            const file = new File([DOCX_MAGIC], 'syllabus.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await FileExtractionService.extractText(file)

            expect(result.text).toContain('PHI 631')
            expect(result.text).toContain('Chapitre 1')
            expect(result.type).toBe('docx')
            expect(mammoth.extractRawText).toHaveBeenCalled()
        })

        it('devrait aussi accepter le MIME type .doc', async () => {
            const mammoth = require('mammoth')
            mammoth.extractRawText.mockResolvedValue({ value: 'Doc content' })

            const file = new File([DOC_MAGIC], 'old.doc', {
                type: 'application/msword',
            })

            const result = await FileExtractionService.extractText(file)

            expect(result.text).toBe('Doc content')
            expect(result.type).toBe('docx')
        })

        it('devrait propager l\'erreur si mammoth echoue', async () => {
            const mammoth = require('mammoth')
            mammoth.extractRawText.mockRejectedValue(new Error('Cannot read .doc'))

            const file = new File([DOCX_MAGIC], 'corrupt.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            await expect(FileExtractionService.extractText(file)).rejects.toThrow('Cannot read .doc')
        })
    })

    // =========================================
    // EXTRACTION IMAGE (BASE64)
    // =========================================

    describe('extractText — Image', () => {
        it('devrait convertir un JPG en base64 data URI', async () => {
            const file = new File([JPEG_MAGIC], 'photo.jpg', { type: 'image/jpeg' })

            const result = await FileExtractionService.extractText(file)

            expect(result.type).toBe('image')
            expect(result.text).toMatch(/^data:image\/jpeg;base64,/)
        })

        it('devrait convertir un PNG en base64 data URI', async () => {
            const file = new File([PNG_MAGIC], 'photo.png', { type: 'image/png' })

            const result = await FileExtractionService.extractText(file)

            expect(result.type).toBe('image')
            expect(result.text).toMatch(/^data:image\/png;base64,/)
        })
    })
})
