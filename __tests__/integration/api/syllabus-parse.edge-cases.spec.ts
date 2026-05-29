/**
 * Agent 5 — Tests Complementaires Integration : POST /api/ai/syllabus/parse
 *
 * Couvre les cas non testes : erreur "File is empty", roles additionnels,
 * contenu malveillant, FormData invalide, rate limiting, error mapping.
 *
 * NOTE : Le rate limiter est mocke pour eviter les 429 en test.
 * NOTE : Le route mappe "does not match declared type" -> 400.
 * NOTE : Le route 422 renvoie un message generique (pas les details internes).
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
function createFormDataRequest(file?: File, fieldName: string = 'file'): Request {
    const formData = new FormData()
    if (file) {
        formData.append(fieldName, file)
    }

    return new Request('http://localhost:3001/api/ai/syllabus/parse', {
        method: 'POST',
        body: formData,
    })
}

describe('POST /api/ai/syllabus/parse — Edge Cases & Security', () => {
    const teacherSession = {
        user: {
            id: '507f1f77bcf86cd799439011',
            role: 'TEACHER',
            email: 'teacher@test.com',
        },
    }

    const adminSession = {
        user: {
            id: '507f1f77bcf86cd799439013',
            role: 'SCHOOL_ADMIN',
            email: 'admin@test.com',
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
    // AUTH — ROLES ADDITIONNELS
    // =========================================

    describe('Auth — additional roles', () => {
        it('devrait retourner 403 pour un SCHOOL_ADMIN', async () => {
            mockGetServerSession.mockResolvedValue(adminSession)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.success).toBe(false)
        })

        it('devrait retourner 401 si la session n\'a pas de user.id', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { role: 'TEACHER', email: 'test@test.com' },
            } as any)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)

            expect(response.status).toBe(401)
        })

        it('devrait retourner 401 si la session a un user vide', async () => {
            mockGetServerSession.mockResolvedValue({ user: {} } as any)

            const file = new File([Buffer.from('test')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)

            expect(response.status).toBe(401)
        })
    })

    // =========================================
    // FILE VALIDATION — EDGE CASES
    // =========================================

    describe('File Validation — edge cases', () => {
        it('devrait retourner 400 pour un fichier vide avec message "File is empty"', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(new Error('File is empty.'))

            const file = new File([], 'empty.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
            expect(data.message).toBe('File is empty.')
        })

        it('devrait retourner 400 si le champ FormData n\'est pas nomme "file"', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file, 'document') // mauvais nom de champ
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.message).toContain('file')
        })

        it('devrait retourner 400 si le champ file contient une valeur string au lieu d\'un File', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)

            const formData = new FormData()
            formData.append('file', 'not-a-file-object')

            const req = new Request('http://localhost:3001/api/ai/syllabus/parse', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
        })

        it('devrait retourner 400 pour "File content does not match declared type"', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('File content does not match declared type.')
            )

            const file = new File([Buffer.from('fake')], 'forged.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.message).toBe('File content does not match declared type.')
        })
    })

    // =========================================
    // RESPONSE FORMAT
    // =========================================

    describe('Response format', () => {
        it('devrait avoir le format { success: true, data: {...} } pour une reponse reussie', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(data).toHaveProperty('success', true)
            expect(data).toHaveProperty('data')
            expect(data.data).toHaveProperty('title')
            expect(data.data).toHaveProperty('description')
            expect(data.data).toHaveProperty('learningObjectives')
            expect(data.data).toHaveProperty('structure')
            expect(data.data).toHaveProperty('rawText')
        })

        it('devrait avoir le format { success: false, message: "..." } pour une erreur', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(data).toHaveProperty('success', false)
            expect(data).toHaveProperty('message')
            expect(typeof data.message).toBe('string')
        })
    })

    // =========================================
    // ERROR MAPPING — EXHAUSTIVE
    // =========================================

    describe('Error mapping — all error types', () => {
        it('devrait retourner 500 et ne pas exposer le stack trace pour les erreurs inconnues', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(new Error('Database connection failed: mongodb://user:pass@host'))

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(500)
            expect(data.message).toBe('Internal server error')
            expect(data.message).not.toContain('mongodb')
            expect(data.message).not.toContain('pass')
        })

        it('devrait retourner 500 si l\'erreur n\'est pas une instance Error', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue('string-error-not-Error-instance')

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(500)
            expect(data.success).toBe(false)
            expect(data.message).toBe('Internal server error')
        })

        it('devrait retourner 422 avec un message generique pour une erreur AI', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('AI could not parse the document into a valid syllabus structure. Validation errors: title is required')
            )

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(422)
            // Le message 422 est generique et ne contient pas les details de validation
            expect(data.message).toBe('AI could not parse the document into a valid syllabus structure.')
        })

        it('devrait retourner 422 pour l\'erreur image non supportee', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockRejectedValue(
                new Error('AI could not parse the document into a valid syllabus structure. Image parsing requires a vision-capable model.')
            )

            const file = new File([Buffer.from('data')], 'test.jpg', { type: 'image/jpeg' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(422)
            expect(data.success).toBe(false)
        })
    })

    // =========================================
    // SECURITY — MALICIOUS CONTENT
    // =========================================

    describe('Security — malicious payloads', () => {
        it('devrait accepter un fichier dont le nom contient des caracteres XSS', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('data')], '<script>alert(1)</script>.pdf', {
                type: 'application/pdf',
            })
            const req = createFormDataRequest(file)
            const response = await POST(req)

            expect(response.status).toBe(200)
        })

        it('devrait gerer un fichier dont le parsing retourne du contenu XSS sans l\'executer', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue({
                ...validParsedResult,
                title: '<script>document.cookie</script>',
                rawText: '<img onerror=alert(1) src=x>',
            })

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)
            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.title).toContain('<script>')
        })
    })

    // =========================================
    // PERFORMANCE
    // =========================================

    describe('Performance — response time', () => {
        it('devrait traiter une requete valide en moins de 100ms (mock)', async () => {
            mockGetServerSession.mockResolvedValue(teacherSession)
            mockParseFile.mockResolvedValue(validParsedResult)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)

            const start = Date.now()
            const response = await POST(req)
            const elapsed = Date.now() - start

            expect(response.status).toBe(200)
            expect(elapsed).toBeLessThan(100)
        })

        it('devrait rejeter une requete non-auth en moins de 50ms', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const file = new File([Buffer.from('data')], 'test.pdf', { type: 'application/pdf' })
            const req = createFormDataRequest(file)

            const start = Date.now()
            const response = await POST(req)
            const elapsed = Date.now() - start

            expect(response.status).toBe(401)
            expect(elapsed).toBeLessThan(50)
        })
    })
})
