/**
 * Agent 5 — Tests Complementaires : SyllabusParsingService
 *
 * Couvre les cas limites et branches non testees dans l'orchestrateur :
 * contentType text vs image rejection, text truncation, rawText apercu.
 *
 * NOTE : La version actuelle du service :
 *   - rejette les images (pas de modele vision disponible)
 *   - tronque le texte a 30000 caracteres pour l'IA
 *   - retourne rawText tronque a 500 caracteres
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { SyllabusParsingService } from '@/lib/services/SyllabusParsingService'

// Mock les dependances
jest.mock('@/lib/services/FileExtractionService', () => ({
    FileExtractionService: {
        validateFile: jest.fn(),
        extractText: jest.fn(),
    },
}))

jest.mock('@/lib/ai/strategies/AIParsingStrategyManager', () => {
    const mockStrategy = {
        id: 'huggingface',
        name: 'HuggingFace',
        isEnabled: jest.fn().mockReturnValue(true),
        parseToSyllabus: jest.fn(),
    }
    return {
        AIParsingStrategyManager: {
            getInstance: jest.fn().mockReturnValue({
                getActiveStrategy: jest.fn().mockReturnValue(mockStrategy),
            }),
        },
        __mockStrategy: mockStrategy,
    }
})

describe('SyllabusParsingService — Edge Cases', () => {
    let mockFileExtraction: any
    let mockStrategy: any

    const validParsedSyllabus = {
        title: 'PHI 631 — Civisme',
        description: 'Cours de philosophie',
        learningObjectives: ['Comprendre le civisme'],
        structure: {
            chapters: [{
                title: 'Introduction',
                description: '',
                topics: [{
                    title: 'Definition',
                    content: '',
                    concepts: [{ title: 'Civisme', description: '' }],
                }],
            }],
        },
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockFileExtraction = require('@/lib/services/FileExtractionService').FileExtractionService
        mockStrategy = require('@/lib/ai/strategies/AIParsingStrategyManager').__mockStrategy
    })

    // =========================================
    // CONTENT TYPE MAPPING
    // =========================================

    describe('parseFile — contentType mapping', () => {
        it('devrait passer contentType="text" pour un fichier PDF', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'PDF text content',
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.pdf', { type: 'application/pdf' })

            await SyllabusParsingService.parseFile(file)

            expect(mockStrategy.parseToSyllabus).toHaveBeenCalledWith(
                'PDF text content',
                'fr',
                'text'
            )
        })

        it('devrait passer contentType="text" pour un fichier DOCX', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'DOCX text content',
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            await SyllabusParsingService.parseFile(file)

            expect(mockStrategy.parseToSyllabus).toHaveBeenCalledWith(
                'DOCX text content',
                'fr',
                'text'
            )
        })

        it('devrait rejeter les images avec un message explicite (pas de modele vision)', async () => {
            const base64 = 'data:image/png;base64,iVBORw0KGgo='
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: base64,
                type: 'image',
            })

            const file = new File([Buffer.from('img')], 'photo.png', { type: 'image/png' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'AI could not parse the document into a valid syllabus structure. Image parsing requires a vision-capable model.'
            )
            // La strategie IA ne doit PAS etre appelee pour les images
            expect(mockStrategy.parseToSyllabus).not.toHaveBeenCalled()
        })
    })

    // =========================================
    // TRUNCATION DU TEXTE
    // =========================================

    describe('parseFile — text truncation', () => {
        it('devrait tronquer le texte a 30000 caracteres avant envoi a l\'IA', async () => {
            const longText = 'A'.repeat(50000)
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: longText,
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'long.pdf', { type: 'application/pdf' })

            await SyllabusParsingService.parseFile(file)

            const sentText = mockStrategy.parseToSyllabus.mock.calls[0][0]
            expect(sentText.length).toBe(30000)
            expect(sentText).toBe('A'.repeat(30000))
        })

        it('devrait ne pas tronquer le texte s\'il est inferieur a 30000 caracteres', async () => {
            const shortText = 'B'.repeat(1000)
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: shortText,
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'short.pdf', { type: 'application/pdf' })

            await SyllabusParsingService.parseFile(file)

            const sentText = mockStrategy.parseToSyllabus.mock.calls[0][0]
            expect(sentText.length).toBe(1000)
        })

        it('devrait ne pas tronquer le texte s\'il a exactement 30000 caracteres', async () => {
            const exactText = 'C'.repeat(30000)
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: exactText,
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'exact.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            await SyllabusParsingService.parseFile(file)

            const sentText = mockStrategy.parseToSyllabus.mock.calls[0][0]
            expect(sentText.length).toBe(30000)
        })
    })

    // =========================================
    // RAWTEXT APERCU (500 chars)
    // =========================================

    describe('parseFile — rawText truncation in result', () => {
        it('devrait tronquer rawText a 500 caracteres dans la reponse', async () => {
            const longText = 'D'.repeat(2000)
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: longText,
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.pdf', { type: 'application/pdf' })

            const result = await SyllabusParsingService.parseFile(file)

            expect(result.rawText.length).toBe(500)
            expect(result.rawText).toBe('D'.repeat(500))
        })

        it('devrait retourner rawText complet si le texte fait moins de 500 caracteres', async () => {
            const shortText = 'Short text content'
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: shortText,
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await SyllabusParsingService.parseFile(file)

            expect(result.rawText).toBe(shortText)
        })
    })

    // =========================================
    // TEXTE VIDE EXTRAIT
    // =========================================

    describe('parseFile — empty extracted text', () => {
        it('devrait passer le texte vide a la strategie IA (PDF scanne sans OCR)', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: '',
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('scanned')], 'scan.pdf', { type: 'application/pdf' })

            const result = await SyllabusParsingService.parseFile(file)

            expect(mockStrategy.parseToSyllabus).toHaveBeenCalledWith('', 'fr', 'text')
            expect(result.rawText).toBe('')
        })
    })

    // =========================================
    // PROPAGATION DES ERREURS
    // =========================================

    describe('parseFile — error propagation specifics', () => {
        it('devrait ne pas appeler extractText si validateFile echoue', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => {
                throw new Error('File is empty.')
            })

            const file = new File([], 'empty.pdf', { type: 'application/pdf' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow('File is empty.')
            expect(mockFileExtraction.extractText).not.toHaveBeenCalled()
            expect(mockStrategy.parseToSyllabus).not.toHaveBeenCalled()
        })

        it('devrait ne pas appeler parseToSyllabus si extractText echoue', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockRejectedValue(new Error('Corrupt file'))

            const file = new File([Buffer.from('bad')], 'bad.pdf', { type: 'application/pdf' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow('Corrupt file')
            expect(mockStrategy.parseToSyllabus).not.toHaveBeenCalled()
        })

        it('devrait propager l\'erreur "File content does not match declared type"', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockRejectedValue(
                new Error('File content does not match declared type.')
            )

            const file = new File([Buffer.from('fake')], 'test.pdf', { type: 'application/pdf' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'File content does not match declared type.'
            )
        })
    })

    // =========================================
    // RESULTAT — STRUCTURE COMPLETE
    // =========================================

    describe('parseFile — result structure', () => {
        it('devrait retourner toutes les proprietes du ParsedSyllabusDTO + rawText', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'Extracted text here',
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await SyllabusParsingService.parseFile(file)

            expect(result).toHaveProperty('title')
            expect(result).toHaveProperty('description')
            expect(result).toHaveProperty('learningObjectives')
            expect(result).toHaveProperty('structure')
            expect(result).toHaveProperty('structure.chapters')
            expect(result).toHaveProperty('rawText')
            expect(result.rawText).toBe('Extracted text here')
        })

        it('devrait propager les proprietes du DTO sans modification', async () => {
            const specialSyllabus = {
                title: 'Course with "special" chars & <tags>',
                description: 'Description with\nnewlines',
                learningObjectives: ['Obj 1', 'Obj 2', 'Obj 3'],
                structure: {
                    chapters: [
                        {
                            title: 'Ch1',
                            description: 'Desc 1',
                            topics: [
                                {
                                    title: 'T1',
                                    content: 'Content with unicode \u00e9\u00e0\u00fc',
                                    concepts: [
                                        { title: 'C1', description: 'D1' },
                                        { title: 'C2', description: 'D2' },
                                    ],
                                },
                            ],
                        },
                        {
                            title: 'Ch2',
                            description: '',
                            topics: [],
                        },
                    ],
                },
            }

            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'Raw text',
                type: 'pdf',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(specialSyllabus)

            const file = new File([Buffer.from('fake')], 'test.pdf', { type: 'application/pdf' })

            const result = await SyllabusParsingService.parseFile(file)

            expect(result.title).toBe('Course with "special" chars & <tags>')
            expect(result.structure.chapters).toHaveLength(2)
            expect(result.structure.chapters[0].topics[0].concepts).toHaveLength(2)
            expect(result.learningObjectives).toHaveLength(3)
        })
    })
})
