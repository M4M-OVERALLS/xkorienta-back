/**
 * Tests d'intégration pour les routes API V4
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { createFullSetup } from '../../helpers/factories'
import { ExamType } from '@/models/enums'

// Mock de l'authentification
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
    auth: mockAuth
}))

// Import des handlers Next.js après les mocks
import { GET as getTemplates } from '@/app/api/exams/v4/templates/route'
import { GET as getTemplate } from '@/app/api/exams/v4/templates/[id]/route'
import { POST as initialize } from '@/app/api/exams/v4/initialize/route'
import { PUT as updateContext } from '@/app/api/exams/v4/[draftId]/context/route'
import { PUT as updateTarget } from '@/app/api/exams/v4/[draftId]/target/route'
import { PUT as updateTiming } from '@/app/api/exams/v4/[draftId]/timing/route'
import { POST as validate } from '@/app/api/exams/v4/[draftId]/validate/route'
import { POST as publish } from '@/app/api/exams/v4/[draftId]/publish/route'
import { GET as listDrafts } from '@/app/api/exams/v4/drafts/route'

/**
 * Helper pour créer une requête mock
 */
function createMockRequest(options: {
    method?: string
    url?: string
    body?: any
    searchParams?: Record<string, string>
} = {}) {
    const searchParams = new URLSearchParams(options.searchParams || {})

    return {
        method: options.method || 'GET',
        url: options.url || 'http://localhost:3001/api/test',
        json: async () => options.body,
        nextUrl: {
            searchParams
        }
    } as any
}

describe('API V4 - Templates', () => {
    let setup: any

    beforeEach(async () => {
        setup = await createFullSetup()
        mockAuth.mockResolvedValue({
            user: { id: setup.user._id.toString() }
        })
    })

    describe('GET /api/exams/v4/templates', () => {
        it('devrait lister tous les templates', async () => {
            const request = createMockRequest()
            const response = await getTemplates(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data).toBeDefined()
            expect(data.data.length).toBeGreaterThan(0)
            expect(data.count).toBe(data.data.length)
        })

        it('devrait filtrer par catégorie', async () => {
            const request = createMockRequest({
                searchParams: { category: 'FORMATIVE' }
            })
            const response = await getTemplates(request)
            const data = await response.json()

            expect(data.success).toBe(true)
            expect(data.data.every((t: any) => t.category === 'FORMATIVE')).toBe(true)
        })
    })

    describe('GET /api/exams/v4/templates/:id', () => {
        it('devrait récupérer un template spécifique', async () => {
            const request = createMockRequest()
            const params = { id: 'self-assessment' }
            const response = await getTemplate(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.id).toBe('self-assessment')
            expect(data.data.examType).toBe(ExamType.SELF_ASSESSMENT)
        })

        it('devrait retourner 404 pour template inexistant', async () => {
            const request = createMockRequest()
            const params = { id: 'inexistant' }
            const response = await getTemplate(request, { params })
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.success).toBe(false)
        })
    })
})

describe('API V4 - Workflow de création', () => {
    let setup: any
    let draftId: string

    beforeEach(async () => {
        setup = await createFullSetup()
        mockAuth.mockResolvedValue({
            user: { id: setup.user._id.toString() }
        })
    })

    describe('POST /api/exams/v4/initialize', () => {
        it('devrait initialiser un nouveau builder', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    templateId: 'self-assessment',
                    title: 'Test Auto-évaluation'
                }
            })

            const response = await initialize(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.success).toBe(true)
            expect(data.data.draftId).toBeDefined()
            expect(data.data.template.examType).toBe(ExamType.SELF_ASSESSMENT)

            draftId = data.data.draftId
        })

        it('devrait rejeter un templateId invalide', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    templateId: 'inexistant'
                }
            })

            const response = await initialize(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.success).toBe(false)
        })

        it('devrait rejeter sans templateId', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {}
            })

            const response = await initialize(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('templateId')
        })

        it('devrait rejeter sans authentification', async () => {
            mockAuth.mockResolvedValue(null)

            const request = createMockRequest({
                method: 'POST',
                body: { templateId: 'self-assessment' }
            })

            const response = await initialize(request)
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error).toContain('Non authentifié')
        })
    })

    describe('PUT /api/exams/v4/:draftId/context', () => {
        beforeEach(async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    templateId: 'self-assessment',
                    title: 'Test'
                }
            })
            const response = await initialize(request)
            const data = await response.json()
            draftId = data.data.draftId
        })

        it('devrait mettre à jour le contexte', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {
                    schoolId: setup.school._id.toString(),
                    targetLevelIds: [setup.level._id.toString()]
                }
            })
            const params = { draftId }

            const response = await updateContext(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.validation).toBeDefined()
        })

        it('devrait rejeter sans targetLevelIds', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {
                    targetLevelIds: []
                }
            })
            const params = { draftId }

            const response = await updateContext(request, { params })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('niveau cible')
        })
    })

    describe('PUT /api/exams/v4/:draftId/target', () => {
        beforeEach(async () => {
            const initRequest = createMockRequest({
                method: 'POST',
                body: { templateId: 'self-assessment', title: 'Test' }
            })
            const initResponse = await initialize(initRequest)
            const initData = await initResponse.json()
            draftId = initData.data.draftId

            const contextRequest = createMockRequest({
                method: 'PUT',
                body: {
                    targetLevelIds: [setup.level._id.toString()]
                }
            })
            await updateContext(contextRequest, { params: { draftId } })
        })

        it('devrait mettre à jour la cible', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {
                    subjectId: setup.subject._id.toString(),
                    syllabusId: setup.syllabus._id.toString(),
                    learningUnitIds: [setup.chapter._id.toString()],
                    linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
                }
            })
            const params = { draftId }

            const response = await updateTarget(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
        })

        it('devrait rejeter sans subjectId', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {}
            })
            const params = { draftId }

            const response = await updateTarget(request, { params })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('matière')
        })
    })

    describe('PUT /api/exams/v4/:draftId/timing', () => {
        beforeEach(async () => {
            const initRequest = createMockRequest({
                method: 'POST',
                body: { templateId: 'self-assessment', title: 'Test' }
            })
            const initResponse = await initialize(initRequest)
            const initData = await initResponse.json()
            draftId = initData.data.draftId
        })

        it('devrait mettre à jour le timing', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {
                    startTime: new Date('2026-04-10T08:00:00'),
                    endTime: new Date('2026-04-17T23:59:59'),
                    duration: 15
                }
            })
            const params = { draftId }

            const response = await updateTiming(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBeDefined()
        })

        it('devrait rejeter des paramètres manquants', async () => {
            const request = createMockRequest({
                method: 'PUT',
                body: {
                    startTime: new Date()
                    // Manque endTime et duration
                }
            })
            const params = { draftId }

            const response = await updateTiming(request, { params })
            const data = await response.json()

            expect(response.status).toBe(400)
        })
    })

    describe('POST /api/exams/v4/:draftId/validate', () => {
        beforeEach(async () => {
            const initRequest = createMockRequest({
                method: 'POST',
                body: { templateId: 'self-assessment', title: 'Test Validation' }
            })
            const initResponse = await initialize(initRequest)
            const initData = await initResponse.json()
            draftId = initData.data.draftId
        })

        it('devrait valider un brouillon incomplet', async () => {
            const request = createMockRequest({ method: 'POST' })
            const params = { draftId }

            const response = await validate(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.validation.valid).toBe(false)
            expect(data.validation.errors.length).toBeGreaterThan(0)
        })
    })

    describe('POST /api/exams/v4/:draftId/publish', () => {
        beforeEach(async () => {
            // Créer et configurer complètement un examen
            const initRequest = createMockRequest({
                method: 'POST',
                body: { templateId: 'self-assessment', title: 'Test Publication' }
            })
            const initResponse = await initialize(initRequest)
            const initData = await initResponse.json()
            draftId = initData.data.draftId

            // Contexte
            await updateContext(
                createMockRequest({
                    method: 'PUT',
                    body: {
                        schoolId: setup.school._id.toString(),
                        targetLevelIds: [setup.level._id.toString()]
                    }
                }),
                { params: { draftId } }
            )

            // Cible
            await updateTarget(
                createMockRequest({
                    method: 'PUT',
                    body: {
                        subjectId: setup.subject._id.toString(),
                        syllabusId: setup.syllabus._id.toString(),
                        learningUnitIds: [setup.chapter._id.toString()],
                        linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
                    }
                }),
                { params: { draftId } }
            )

            // Timing
            await updateTiming(
                createMockRequest({
                    method: 'PUT',
                    body: {
                        startTime: new Date('2026-04-10'),
                        endTime: new Date('2026-04-17'),
                        duration: 15
                    }
                }),
                { params: { draftId } }
            )
        })

        it('devrait publier un examen valide', async () => {
            const request = createMockRequest({ method: 'POST' })
            const params = { draftId }

            const response = await publish(request, { params })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.status).toBe('PUBLISHED')
        })
    })

    describe('GET /api/exams/v4/drafts', () => {
        beforeEach(async () => {
            // Créer 2 brouillons
            await initialize(
                createMockRequest({
                    method: 'POST',
                    body: { templateId: 'self-assessment', title: 'Draft 1' }
                })
            )
            await initialize(
                createMockRequest({
                    method: 'POST',
                    body: { templateId: 'formative-quiz', title: 'Draft 2' }
                })
            )
        })

        it('devrait lister les brouillons de l\'utilisateur', async () => {
            const request = createMockRequest()
            const response = await listDrafts(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.length).toBe(2)
            expect(data.count).toBe(2)
        })
    })
})
