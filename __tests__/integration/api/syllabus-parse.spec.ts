/**
 * TDD Tests — Integration : POST /api/ai/syllabus/parse
 *
 * Teste l'endpoint complet de parsing de syllabus.
 * Verifie auth, validation, extraction et reponse.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { getServerSession } from 'next-auth'
import { SyllabusParsingService } from '@/lib/services/SyllabusParsingService'

// Mock modules
jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/services/SyllabusParsingService')

// Mock le rate limiter pour eviter les 429 en test
jest.mock('@/lib/security/rateLimiter', () => ({
    rateLimit: () => () => ({ success: true, limit: 5, remaining: 4, resetTime: Date.now() + 60000 }),
    createRateLimitResponse: jest.fn(),
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockParseFile = SyllabusParsingService.parseFile as jest.MockedFunction<typeof SyllabusParsingService.parseFile>

// Import route apres les mocks
import { POST } from '@/app/api/ai/syllabus/parse/route'

/**
 * Helper pour creer une Request avec FormData
 */
function createFormDataRequest(file?: File, extraHeaders?: Record<string, string>): Request {
    const formData = new FormData()
    if (file) {
        formData.append('file', file)
    }

    return new Request('http://localhost:3001/api/ai/syllabus/parse', {
        method: 'POST',
        body: formData,
        headers: extraHeaders,
    })
}

describe('POST /api/ai/syllabus/parse', () => {
    const teacherSession = {
        user: {
            id: '507f1f77bcf86cd799439011',
            role: 'TEACHER',
            email: 'teacher@test.com',
        },
    }

    const studentSession = {
        user: {
            id: '507f1f77bcf86cd799439012',
            role: 'STUDENT',
            email: 'student@test.com',
        },
    }

    const validParsedResult = {
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
        rawText: 'PHI 631 — Civisme...',
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    // =========================================
    // AUTHENTIFICATION & AUTORISATION
    // =========================================

    describe('Auth & Roles', () => {
        it('devrait retourner 401 si l\'utilisateur n\'est pas authentifie', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.success).toBe(false)
        })

        it('devrait retourner 403 si l\'utilisateur n\'est pas TEACHER', async () => {
            mockGetServerSession.mockResolvedValue(studentSession)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.success).toBe(false)
        })

        it('devrait accepter un TEACHER authentifie', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)

            expect(response.status).toBe(200)
        })
    })

    // =========================================
    // VALIDATION DU FICHIER
    // =========================================

    describe('File Validation', () => {
        it('devrait retourner 400 si aucun fichier n\'est envoye', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)

            const req = createFormDataRequest() // pas de fichier
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
            expect(data.message).toContain('file')
        })

        it('devrait retourner 400 pour un format non supporte', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('Unsupported file type. Use PDF, DOCX, or image.')
            )

            const file = new File([Buffer.from('data')], 'test.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.message).toBe('Unsupported file type. Use PDF, DOCX, or image.')
        })

        it('devrait retourner 400 pour un fichier > 20 MB', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('File exceeds the 20 MB limit.')
            )

            const file = new File([Buffer.from('x')], 'big.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.message).toBe('File exceeds the 20 MB limit.')
        })
    })

    // =========================================
    // PARSING REUSSI
    // =========================================

    describe('Parsing Success', () => {
        it('devrait retourner 200 avec la structure parsee pour un PDF', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('pdf-content')], 'syllabus.pdf', {
                type: 'application/pdf',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.title).toBe('PHI 631 — Civisme')
            expect(data.data.structure.chapters).toBeDefined()
            expect(data.data.structure.chapters.length).toBeGreaterThan(0)
            expect(data.data.rawText).toBeDefined()
        })

        it('devrait retourner 200 avec la structure parsee pour un DOCX', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('docx-content')], 'syllabus.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.title).toBeTruthy()
        })

        it('devrait retourner 200 avec la structure parsee pour une image', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('img-bytes')], 'syllabus.jpg', {
                type: 'image/jpeg',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
        })

        it('devrait inclure learningObjectives dans la reponse', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(data.data.learningObjectives).toBeDefined()
            expect(Array.isArray(data.data.learningObjectives)).toBe(true)
        })
    })

    // =========================================
    // ERREURS DE PARSING
    // =========================================

    describe('Parsing Errors', () => {
        it('devrait retourner 422 si l\'IA ne peut pas structurer le document', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('AI could not parse the document into a valid syllabus structure.')
            )

            const file = new File([Buffer.from('random')], 'random.pdf', {
                type: 'application/pdf',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(422)
            expect(data.success).toBe(false)
            expect(data.message).toContain('AI could not parse')
        })

        it('devrait retourner 500 pour une erreur interne inattendue', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(new Error('Unexpected crash'))

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(500)
            expect(data.success).toBe(false)
        })
    })
})
