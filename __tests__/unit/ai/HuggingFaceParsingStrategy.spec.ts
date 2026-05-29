/**
 * TDD Tests — HuggingFaceParsingStrategy
 *
 * Teste l'implementation HuggingFace du parsing IA.
 * Verifie l'appel API, le parsing JSON, la gestion d'erreurs.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { HuggingFaceParsingStrategy } from '@/lib/ai/strategies/HuggingFaceParsingStrategy'

// Mock fetch globalement
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('HuggingFaceParsingStrategy', () => {
    const strategy = new HuggingFaceParsingStrategy()
    const originalEnv = process.env

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...originalEnv, HUGGINGFACE_API_KEY: 'test-api-key' }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('proprietes', () => {
        it('devrait avoir l\'id "huggingface"', () => {
            expect(strategy.id).toBe('huggingface')
        })

        it('devrait avoir un nom descriptif', () => {
            expect(strategy.name).toBeTruthy()
            expect(typeof strategy.name).toBe('string')
        })
    })

    describe('isEnabled', () => {
        it('devrait etre active si HUGGINGFACE_API_KEY est defini', () => {
            process.env.HUGGINGFACE_API_KEY = 'valid-key'
            expect(strategy.isEnabled()).toBe(true)
        })

        it('devrait etre desactive si HUGGINGFACE_API_KEY est absent', () => {
            delete process.env.HUGGINGFACE_API_KEY
            expect(strategy.isEnabled()).toBe(false)
        })
    })

    describe('parseToSyllabus', () => {
        const sampleText = `
            PHI 631 — Civisme et Ethique

            Objectifs :
            - Comprendre les fondements du civisme
            - Analyser les enjeux ethiques

            Chapitre 1 : Introduction au civisme
              1.1 Definition et origines
              1.2 Civisme et citoyennete

            Chapitre 2 : Ethique et societe
              2.1 Les valeurs morales
              2.2 L'ethique professionnelle
        `

        const validAIResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        title: 'PHI 631 — Civisme et Ethique',
                        description: 'Cours de philosophie sur le civisme et l\'ethique',
                        learningObjectives: [
                            'Comprendre les fondements du civisme',
                            'Analyser les enjeux ethiques',
                        ],
                        structure: {
                            chapters: [
                                {
                                    title: 'Introduction au civisme',
                                    description: '',
                                    topics: [
                                        {
                                            title: 'Definition et origines',
                                            content: '',
                                            concepts: [{ title: 'Civisme', description: 'Notion de civisme' }],
                                        },
                                        {
                                            title: 'Civisme et citoyennete',
                                            content: '',
                                            concepts: [],
                                        },
                                    ],
                                },
                                {
                                    title: 'Ethique et societe',
                                    description: '',
                                    topics: [
                                        {
                                            title: 'Les valeurs morales',
                                            content: '',
                                            concepts: [],
                                        },
                                        {
                                            title: 'L\'ethique professionnelle',
                                            content: '',
                                            concepts: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    }),
                },
            }],
        }

        it('devrait parser du texte en structure syllabus valide', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => validAIResponse,
            })

            const result = await strategy.parseToSyllabus(sampleText, 'fr')

            expect(result.title).toBeTruthy()
            expect(result.structure.chapters).toBeDefined()
            expect(result.structure.chapters.length).toBeGreaterThan(0)
        })

        it('devrait retourner des chapitres avec des topics', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => validAIResponse,
            })

            const result = await strategy.parseToSyllabus(sampleText, 'fr')

            const firstChapter = result.structure.chapters[0]
            expect(firstChapter.title).toBeTruthy()
            expect(firstChapter.topics).toBeDefined()
            expect(firstChapter.topics.length).toBeGreaterThan(0)
        })

        it('devrait extraire les objectifs pedagogiques', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => validAIResponse,
            })

            const result = await strategy.parseToSyllabus(sampleText, 'fr')

            expect(result.learningObjectives).toBeDefined()
            expect(Array.isArray(result.learningObjectives)).toBe(true)
        })

        it('devrait appeler l\'API HuggingFace avec le bon format', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => validAIResponse,
            })

            await strategy.parseToSyllabus(sampleText, 'fr')

            expect(mockFetch).toHaveBeenCalledTimes(1)
            const [url, options] = mockFetch.mock.calls[0]
            expect(url).toContain('huggingface')
            expect(options.method).toBe('POST')
            expect(options.headers['Authorization']).toBe('Bearer test-api-key')

            const body = JSON.parse(options.body)
            expect(body.messages).toBeDefined()
            expect(body.messages.length).toBeGreaterThanOrEqual(2)
        })

        it('devrait lancer une erreur si l\'API retourne une erreur', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            })

            await expect(strategy.parseToSyllabus(sampleText, 'fr')).rejects.toThrow()
        })

        it('devrait lancer une erreur si la reponse n\'est pas du JSON valide', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: 'This is not valid JSON at all' },
                    }],
                }),
            })

            await expect(strategy.parseToSyllabus(sampleText, 'fr')).rejects.toThrow()
        })

        it('devrait lancer une erreur si le JSON ne correspond pas au schema attendu', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                // Missing required 'title' and 'structure'
                                foo: 'bar',
                            }),
                        },
                    }],
                }),
            })

            await expect(strategy.parseToSyllabus(sampleText, 'fr')).rejects.toThrow()
        })

        it('devrait lancer une erreur si API key n\'est pas configuree', async () => {
            delete process.env.HUGGINGFACE_API_KEY

            await expect(strategy.parseToSyllabus(sampleText, 'fr')).rejects.toThrow()
        })

        it('devrait essayer un modele de fallback si le premier echoue (503)', async () => {
            // Premier appel : modele en chargement
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                text: async () => 'Model is loading',
            })
            // Deuxieme appel : succes
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => validAIResponse,
            })

            const result = await strategy.parseToSyllabus(sampleText, 'fr')

            expect(result.title).toBeTruthy()
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })
    })
})
