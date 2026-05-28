/**
 * Agent 5 — Tests Complementaires : HuggingFaceParsingStrategy
 *
 * Couvre les branches non testees : markdown JSON extraction, fallback complet,
 * reponses API malformees, parametres de langue, securite du contenu.
 *
 * NOTE : le callAPI utilise un AbortController avec timeout de 30s.
 * NOTE : le message d'erreur final ne contient PAS les details internes (securite).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { HuggingFaceParsingStrategy } from '@/lib/ai/strategies/HuggingFaceParsingStrategy'

// Mock fetch globalement
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('HuggingFaceParsingStrategy — Edge Cases & Security', () => {
    const strategy = new HuggingFaceParsingStrategy()
    const originalEnv = process.env

    const validSyllabusJSON = JSON.stringify({
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
    })

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...originalEnv, HUGGINGFACE_API_KEY: 'test-api-key' }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    // =========================================
    // PARSING JSON ENTOURE DE MARKDOWN
    // =========================================

    describe('parseToSyllabus — markdown-wrapped JSON', () => {
        it('devrait extraire le JSON d\'un bloc ```json ... ```', async () => {
            const markdownWrapped = '```json\n' + validSyllabusJSON + '\n```'

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: markdownWrapped },
                    }],
                }),
            })

            const result = await strategy.parseToSyllabus('Some syllabus text', 'fr')

            expect(result.title).toBe('PHI 631 — Civisme')
            expect(result.structure.chapters.length).toBe(1)
        })

        it('devrait extraire le JSON d\'un bloc ``` ... ``` sans annotation json', async () => {
            const markdownWrapped = '```\n' + validSyllabusJSON + '\n```'

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: markdownWrapped },
                    }],
                }),
            })

            const result = await strategy.parseToSyllabus('Some syllabus text', 'fr')

            expect(result.title).toBe('PHI 631 — Civisme')
        })

        it('devrait accepter du JSON avec du texte additionnel avant/apres les backticks', async () => {
            const withSurroundingText = 'Here is the result:\n```json\n' + validSyllabusJSON + '\n```\nHope this helps!'

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: withSurroundingText },
                    }],
                }),
            })

            const result = await strategy.parseToSyllabus('Some syllabus text', 'fr')

            expect(result.title).toBe('PHI 631 — Civisme')
        })
    })

    // =========================================
    // FALLBACK COMPLET — TOUS LES MODELES ECHOUENT
    // =========================================

    describe('parseToSyllabus — complete fallback exhaustion', () => {
        it('devrait lancer une erreur apres que les 3 modeles ont echoue', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                    text: async () => 'Model loading',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                    text: async () => 'Model loading',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                    text: async () => 'Model loading',
                })

            await expect(
                strategy.parseToSyllabus('Some text', 'fr')
            ).rejects.toThrow('AI could not parse the document into a valid syllabus structure.')

            expect(mockFetch).toHaveBeenCalledTimes(3)
        })

        it('devrait ne PAS inclure les details internes dans le message d\'erreur (securite)', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    text: async () => 'Internal server error with secret details',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    text: async () => 'Another internal error',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    text: async () => 'Last error with API key details',
                })

            try {
                await strategy.parseToSyllabus('Some text', 'fr')
                fail('Should have thrown')
            } catch (error) {
                const message = (error as Error).message
                // Le message ne doit PAS leaker les details internes de l'API
                expect(message).not.toContain('secret')
                expect(message).not.toContain('API key')
                expect(message).toBe('AI could not parse the document into a valid syllabus structure.')
            }
        })
    })

    // =========================================
    // REPONSES API MALFORMEES
    // =========================================

    describe('parseToSyllabus — malformed API responses', () => {
        it('devrait lancer une erreur si choices est un tableau vide', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [] }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [] }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [] }),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow()
        })

        it('devrait lancer une erreur si choices est absent', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow()
        })

        it('devrait lancer une erreur si message.content est null', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: null } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: null } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: null } }],
                }),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow()
        })

        it('devrait lancer une erreur si message.content est une chaine vide', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '' } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '' } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '' } }],
                }),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow()
        })
    })

    // =========================================
    // ERREURS RESEAU
    // =========================================

    describe('parseToSyllabus — network errors', () => {
        it('devrait gerer un timeout/erreur reseau (fetch throw)', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockRejectedValueOnce(new Error('Network timeout'))

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow('AI could not parse the document')

            expect(mockFetch).toHaveBeenCalledTimes(3)
        })

        it('devrait reussir si le premier modele timeout mais le deuxieme repond', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('fetch failed'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        choices: [{
                            message: { content: validSyllabusJSON },
                        }],
                    }),
                })

            const result = await strategy.parseToSyllabus('text', 'fr')

            expect(result.title).toBe('PHI 631 — Civisme')
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })
    })

    // =========================================
    // PARAMETRE DE LANGUE
    // =========================================

    describe('parseToSyllabus — language parameter', () => {
        it('devrait envoyer les prompts en anglais quand language="en"', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: validSyllabusJSON },
                    }],
                }),
            })

            await strategy.parseToSyllabus('English syllabus text', 'en')

            const [, options] = mockFetch.mock.calls[0]
            const body = JSON.parse(options.body)
            const systemMessage = body.messages[0].content

            expect(systemMessage).toContain('syllabi')
        })

        it('devrait envoyer les prompts en francais quand language="fr"', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: validSyllabusJSON },
                    }],
                }),
            })

            await strategy.parseToSyllabus('Texte du syllabus', 'fr')

            const [, options] = mockFetch.mock.calls[0]
            const body = JSON.parse(options.body)
            const systemMessage = body.messages[0].content

            expect(systemMessage).toContain('syllabus academiques')
        })
    })

    // =========================================
    // VALIDATION ZOD — EDGE CASES
    // =========================================

    describe('parseToSyllabus — Zod validation edge cases', () => {
        it('devrait rejeter un syllabus sans chapitres (tableau vide)', async () => {
            const noChapters = JSON.stringify({
                title: 'Test',
                description: '',
                learningObjectives: [],
                structure: { chapters: [] },
            })

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: noChapters } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: noChapters } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: noChapters } }],
                }),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow('AI could not parse')
        })

        it('devrait rejeter un syllabus avec un titre vide', async () => {
            const emptyTitle = JSON.stringify({
                title: '',
                description: '',
                learningObjectives: [],
                structure: {
                    chapters: [{
                        title: 'Ch1',
                        description: '',
                        topics: [],
                    }],
                },
            })

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: emptyTitle } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: emptyTitle } }],
                }),
            })
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: emptyTitle } }],
                }),
            })

            await expect(
                strategy.parseToSyllabus('text', 'fr')
            ).rejects.toThrow('AI could not parse')
        })

        it('devrait accepter un syllabus avec des champs optionnels manquants', async () => {
            const minimalValid = JSON.stringify({
                title: 'Minimal Course',
                structure: {
                    chapters: [{
                        title: 'Chapter 1',
                        topics: [{
                            title: 'Topic 1',
                        }],
                    }],
                },
            })

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: minimalValid } }],
                }),
            })

            const result = await strategy.parseToSyllabus('text', 'fr')

            expect(result.title).toBe('Minimal Course')
            expect(result.description).toBe('')
            expect(result.learningObjectives).toEqual([])
        })
    })

    // =========================================
    // SECURITE — CONTENU MALVEILLANT DANS LA REPONSE IA
    // =========================================

    describe('Security — malicious content in AI response', () => {
        it('devrait accepter un titre contenant des caracteres XSS (la sanitisation est en aval)', async () => {
            const xssJSON = JSON.stringify({
                title: '<script>alert("xss")</script>Course 101',
                description: '<img onerror=alert(1) src=x>',
                learningObjectives: ['<iframe src="evil.com">'],
                structure: {
                    chapters: [{
                        title: 'Chapter<script>1</script>',
                        description: '',
                        topics: [{
                            title: 'Topic 1',
                            content: '',
                            concepts: [],
                        }],
                    }],
                },
            })

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: xssJSON } }],
                }),
            })

            const result = await strategy.parseToSyllabus('text', 'fr')

            expect(result.title).toContain('<script>')
        })

        it('devrait gerer des caracteres d\'echappement JSON dans le contenu AI', async () => {
            const escapedJSON = JSON.stringify({
                title: 'Cours avec "guillemets" et \\backslash',
                description: 'Ligne 1\nLigne 2\tTabulation',
                learningObjectives: [],
                structure: {
                    chapters: [{
                        title: 'Chapter with \\ special chars',
                        description: '',
                        topics: [{
                            title: 'Topic "quoted"',
                            content: '',
                            concepts: [],
                        }],
                    }],
                },
            })

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: escapedJSON } }],
                }),
            })

            const result = await strategy.parseToSyllabus('text', 'fr')

            expect(result.title).toContain('guillemets')
        })
    })

    // =========================================
    // API CALL PARAMETERS
    // =========================================

    describe('parseToSyllabus — API call configuration', () => {
        it('devrait utiliser la temperature 0.3 pour la coherence', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: validSyllabusJSON } }],
                }),
            })

            await strategy.parseToSyllabus('text', 'fr')

            const [, options] = mockFetch.mock.calls[0]
            const body = JSON.parse(options.body)
            expect(body.temperature).toBe(0.3)
        })

        it('devrait limiter les tokens a 2048', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: validSyllabusJSON } }],
                }),
            })

            await strategy.parseToSyllabus('text', 'fr')

            const [, options] = mockFetch.mock.calls[0]
            const body = JSON.parse(options.body)
            expect(body.max_tokens).toBe(2048)
        })

        it('devrait utiliser le bon URL de base HuggingFace', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: validSyllabusJSON } }],
                }),
            })

            await strategy.parseToSyllabus('text', 'fr')

            const [url] = mockFetch.mock.calls[0]
            expect(url).toBe('https://router.huggingface.co/v1/chat/completions')
        })

        it('devrait envoyer Content-Type application/json', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: validSyllabusJSON } }],
                }),
            })

            await strategy.parseToSyllabus('text', 'fr')

            const [, options] = mockFetch.mock.calls[0]
            expect(options.headers['Content-Type']).toBe('application/json')
        })

        it('devrait passer un AbortSignal pour le timeout', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: validSyllabusJSON } }],
                }),
            })

            await strategy.parseToSyllabus('text', 'fr')

            const [, options] = mockFetch.mock.calls[0]
            expect(options.signal).toBeDefined()
            expect(options.signal).toBeInstanceOf(AbortSignal)
        })
    })

    // =========================================
    // ISEMPTY CHECK ON API KEY
    // =========================================

    describe('isEnabled — edge cases', () => {
        it('devrait retourner false si la cle API est une chaine vide', () => {
            process.env.HUGGINGFACE_API_KEY = ''
            expect(strategy.isEnabled()).toBe(false)
        })

        it('devrait retourner true pour n\'importe quelle valeur non-vide', () => {
            process.env.HUGGINGFACE_API_KEY = 'x'
            expect(strategy.isEnabled()).toBe(true)
        })
    })
})
