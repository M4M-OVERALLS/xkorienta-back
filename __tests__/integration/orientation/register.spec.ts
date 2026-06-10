/**
 * Tests d'intégration — POST /api/xkorienta/register
 *
 * Teste l'endpoint d'enregistrement des demandes d'orientation
 * Xkorienta : validation du corps, persistance en base de données
 * et structure de réponse.
 *
 * Utilise mongodb-memory-server pour tester la persistance sans
 * base de données réelle. La connexion Mongoose est établie ici
 * pour garantir l'isolation du test.
 */

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals'
import {
    connectMongoMemory,
    disconnectMongoMemory,
    clearMongoCollections,
} from '../../helpers/mongoMemory'
import { POST } from '@/app/api/xkorienta/register/route'
import XkorientaRegistration from '@/models/XkorientaRegistration'

beforeAll(async () => {
    await connectMongoMemory()
}, 30000)

afterAll(async () => {
    await disconnectMongoMemory()
})

beforeEach(async () => {
    await clearMongoCollections()
})

/**
 * Helper pour créer une Request JSON pour l'endpoint d'enregistrement
 */
function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/xkorienta/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const validBody = {
    student: {
        school: 'Lycée de Yaoundé',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '+237691234567',
        email: 'jean@test.cm',
        neighborhood: 'Bastos',
        class: 'Terminale C',
        specialty: 'Scientifique',
    },
    parent: {
        fullName: 'Marie Dupont',
        phone: '+237691234568',
        email: 'marie@test.cm',
    },
}

describe('POST /api/xkorienta/register', () => {
    // =========================================
    // SUCCESSFUL REGISTRATION
    // =========================================

    describe('successful registration', () => {
        it('should return 201 with registration data for valid body', async () => {
            const response = await POST(makeRequest(validBody))
            const body = await response.json()

            expect(response.status).toBe(201)
            expect(body.success).toBe(true)
            expect(body.data.student.firstName).toBe('Jean')
        })

        it('should persist the registration in the database', async () => {
            const countBefore = await XkorientaRegistration.countDocuments()

            await POST(makeRequest(validBody))

            const countAfter = await XkorientaRegistration.countDocuments()
            expect(countAfter).toBe(countBefore + 1)
        })
    })

    // =========================================
    // VALIDATION ERRORS
    // =========================================

    describe('validation errors', () => {
        it('should return XOR_002 (400) for invalid JSON body', async () => {
            const req = new Request('http://localhost/api/xkorienta/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-json{{{',
            })

            const response = await POST(req)
            const body = await response.json()

            expect(response.status).toBe(400)
            expect(body.error.code).toBe('XOR_002')
        })

        it('should return 500 when required student field is missing', async () => {
            const invalidBody = {
                student: {
                    // missing school
                    firstName: 'Jean',
                    lastName: 'Dupont',
                    phone: '+237691234567',
                    email: 'jean@test.cm',
                    neighborhood: 'Bastos',
                    class: 'Terminale C',
                    specialty: 'Scientifique',
                },
                parent: validBody.parent,
            }

            const response = await POST(makeRequest(invalidBody))
            const body = await response.json()

            expect(response.status).toBe(500)
            expect(body.success).toBe(false)
        })

        it('should return 500 when required parent field is missing', async () => {
            const invalidBody = {
                student: validBody.student,
                parent: {
                    fullName: 'Marie Dupont',
                    // missing phone
                    email: 'marie@test.cm',
                },
            }

            const response = await POST(makeRequest(invalidBody))
            const body = await response.json()

            expect(response.status).toBe(500)
            expect(body.success).toBe(false)
        })
    })

    // =========================================
    // RESPONSE STRUCTURE
    // =========================================

    describe('response structure', () => {
        it('should return success:true on creation', async () => {
            const response = await POST(makeRequest(validBody))
            const body = await response.json()

            expect(body.success).toBe(true)
        })

        it('should include createdAt in response data', async () => {
            const response = await POST(makeRequest(validBody))
            const body = await response.json()

            expect(body.data.createdAt).toBeDefined()
        })

        it('should return error structure with code on failure', async () => {
            const req = new Request('http://localhost/api/xkorienta/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid{json',
            })

            const response = await POST(req)
            const body = await response.json()

            expect(body.error).toBeDefined()
            expect(body.error.code).toBeDefined()
        })
    })
})
