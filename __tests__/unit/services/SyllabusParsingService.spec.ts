/**
 * TDD Tests — SyllabusParsingService
 *
 * Teste le service orchestrateur : validation → extraction → IA → validation Zod
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
                getStrategy: jest.fn().mockReturnValue({ isEnabled: () => false }),
            }),
        },
        __mockStrategy: mockStrategy,
    }
})

describe('SyllabusParsingService', () => {
    let mockFileExtraction: any
    let mockStrategy: any

    beforeEach(() => {
        jest.clearAllMocks()
        mockFileExtraction = require('@/lib/services/FileExtractionService').FileExtractionService
        mockStrategy = require('@/lib/ai/strategies/AIParsingStrategyManager').__mockStrategy
    })

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

    describe('parseFile', () => {
        it('devrait orchestrer validation → extraction → IA → retour', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { /* pas d'erreur */ })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'PHI 631 — Civisme...',
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            const result = await SyllabusParsingService.parseFile(file)

            expect(mockFileExtraction.validateFile).toHaveBeenCalledWith(file)
            expect(mockFileExtraction.extractText).toHaveBeenCalledWith(file)
            expect(mockStrategy.parseToSyllabus).toHaveBeenCalled()

            expect(result.title).toBe('PHI 631 — Civisme')
            expect(result.structure.chapters.length).toBeGreaterThan(0)
            expect(result.rawText).toBe('PHI 631 — Civisme...')
        })

        it('devrait propager l\'erreur de validation du fichier', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => {
                throw new Error('Unsupported file type. Use PDF, DOCX, or image.')
            })

            const file = new File([Buffer.from('fake')], 'test.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'Unsupported file type. Use PDF, DOCX, or image.'
            )
            expect(mockFileExtraction.extractText).not.toHaveBeenCalled()
        })

        it('devrait propager l\'erreur de taille du fichier', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => {
                throw new Error('File exceeds the 20 MB limit.')
            })

            const file = new File([Buffer.from('fake')], 'big.pdf', { type: 'application/pdf' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'File exceeds the 20 MB limit.'
            )
        })

        it('devrait propager l\'erreur d\'extraction', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockRejectedValue(new Error('PDF corrupt'))

            const file = new File([Buffer.from('bad')], 'corrupt.pdf', { type: 'application/pdf' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow('PDF corrupt')
        })

        it('devrait retourner une erreur 422 si l\'IA ne produit pas un JSON valide', async () => {
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({
                text: 'Some text...',
                type: 'docx',
            })
            mockStrategy.parseToSyllabus.mockRejectedValue(
                new Error('AI could not parse the document into a valid syllabus structure.')
            )

            const file = new File([Buffer.from('fake')], 'test.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'AI could not parse the document into a valid syllabus structure.'
            )
        })

        it('devrait inclure un apercu tronque du texte brut (max 500 chars)', async () => {
            const rawText = 'A'.repeat(1000)
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({ text: rawText, type: 'pdf' })
            mockStrategy.parseToSyllabus.mockResolvedValue(validParsedSyllabus)

            const file = new File([Buffer.from('fake')], 'test.pdf', { type: 'application/pdf' })

            const result = await SyllabusParsingService.parseFile(file)

            expect(result.rawText.length).toBe(500)
        })

        it('devrait rejeter les images avec un message explicite', async () => {
            const base64 = 'data:image/jpeg;base64,/9j/4AAQ...'
            mockFileExtraction.validateFile.mockImplementation(() => { })
            mockFileExtraction.extractText.mockResolvedValue({ text: base64, type: 'image' })

            const file = new File([Buffer.from('img')], 'photo.jpg', { type: 'image/jpeg' })

            await expect(SyllabusParsingService.parseFile(file)).rejects.toThrow(
                'Image parsing requires Anthropic (Claude) to be configured'
            )
            expect(mockStrategy.parseToSyllabus).not.toHaveBeenCalled()
        })
    })
})
