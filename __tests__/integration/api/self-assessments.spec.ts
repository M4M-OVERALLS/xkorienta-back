/**
 * Tests d'intégration pour les routes API Self-Assessments
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { createFullSetup, createExamV4, createUser } from '../../helpers/factories'
import { ExamType, ExamStatus, SelfAssessmentLevel } from '@/models/enums'

// Mock de l'authentification
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
    auth: mockAuth
}))

// Import des handlers
import { POST as submit } from '@/app/api/self-assessments/submit/route'
import { GET as getProfile } from '@/app/api/self-assessments/profile/route'
import { GET as getConceptHistory } from '@/app/api/self-assessments/concept-history/route'
import { GET as getClassAnalytics } from '@/app/api/self-assessments/class-analytics/route'

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

describe('API Self-Assessments', () => {
    let setup: any
    let exam: any
    let student: any

    beforeEach(async () => {
        setup = await createFullSetup()
        student = setup.user

        mockAuth.mockResolvedValue({
            user: { id: student._id.toString() }
        })

        // Créer un examen d'auto-évaluation publié
        exam = await createExamV4(student._id.toString(), {
            examType: ExamType.SELF_ASSESSMENT,
            status: ExamStatus.PUBLISHED,
            syllabus: setup.syllabus._id,
            learningUnits: [setup.chapter._id],
            linkedConcepts: setup.concepts.map((c: any) => c._id),
            selfAssessmentConfig: {
                enabled: true,
                scale: { min: 0, max: 6 },
                levels: [
                    { value: 0, emoji: '❓', label: 'Je ne sais pas' },
                    { value: 1, emoji: '😵', label: 'Totalement incapable' },
                    { value: 2, emoji: '😰', label: 'Incapable même avec aide' },
                    { value: 3, emoji: '🤔', label: 'Incapable sans aide' },
                    { value: 4, emoji: '🙂', label: 'Capable avec aide' },
                    { value: 5, emoji: '😊', label: 'Capable sans aide' },
                    { value: 6, emoji: '🌟', label: 'Parfaitement capable' }
                ],
                requireAllConcepts: true
            }
        })
    })

    describe('POST /api/self-assessments/submit', () => {
        it('devrait soumettre une auto-évaluation valide', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: exam._id.toString(),
                    conceptAssessments: [
                        { conceptId: setup.concepts[0]._id.toString(), level: SelfAssessmentLevel.PERFECTLY_ABLE },
                        { conceptId: setup.concepts[1]._id.toString(), level: SelfAssessmentLevel.ABLE_WITH_HELP },
                        { conceptId: setup.concepts[2]._id.toString(), level: SelfAssessmentLevel.UNABLE_ALONE },
                        { conceptId: setup.concepts[3]._id.toString(), level: SelfAssessmentLevel.UNABLE_WITH_HELP }
                    ]
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.success).toBe(true)
            expect(data.data.result).toBeDefined()
            expect(data.data.competencyMap).toBeDefined()
            expect(data.data.recommendations).toBeDefined()

            // Vérifier la cartographie
            expect(data.data.competencyMap.strongConcepts).toHaveLength(1)
            expect(data.data.competencyMap.moderateConcepts).toHaveLength(2)
            expect(data.data.competencyMap.weakConcepts).toHaveLength(1)

            // Vérifier les recommandations
            expect(data.data.recommendations.conceptsToFocus.length).toBeGreaterThan(0)
            expect(data.data.recommendations.message).toBeDefined()
        })

        it('devrait rejeter sans examId', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    conceptAssessments: []
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('examId')
        })

        it('devrait rejeter sans conceptAssessments', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: exam._id.toString()
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('évaluations de concepts')
        })

        it('devrait rejeter si examen inexistant', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: '000000000000000000000000',
                    conceptAssessments: []
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(404)
        })

        it('devrait rejeter si pas de type SELF_ASSESSMENT', async () => {
            const normalExam = await createExamV4(student._id.toString(), {
                examType: ExamType.FORMATIVE_QUIZ,
                status: ExamStatus.PUBLISHED
            })

            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: normalExam._id.toString(),
                    conceptAssessments: []
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('auto-évaluation')
        })

        it('devrait rejeter si concepts manquants', async () => {
            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: exam._id.toString(),
                    conceptAssessments: [
                        { conceptId: setup.concepts[0]._id.toString(), level: 6 }
                        // Manque 3 concepts
                    ]
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('tous les concepts')
        })

        it('devrait rejeter sans authentification', async () => {
            mockAuth.mockResolvedValue(null)

            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: exam._id.toString(),
                    conceptAssessments: []
                }
            })

            const response = await submit(request)
            const data = await response.json()

            expect(response.status).toBe(401)
        })
    })

    describe('GET /api/self-assessments/profile', () => {
        beforeEach(async () => {
            // Soumettre une auto-évaluation
            const request = createMockRequest({
                method: 'POST',
                body: {
                    examId: exam._id.toString(),
                    conceptAssessments: setup.concepts.map((c: any) => ({
                        conceptId: c._id.toString(),
                        level: 4
                    }))
                }
            })
            await submit(request)
        })

        it('devrait récupérer le profil d\'un élève', async () => {
            const request = createMockRequest({
                searchParams: {
                    syllabusId: setup.syllabus._id.toString()
                }
            })

            const response = await getProfile(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.syllabus).toBe(setup.syllabus._id.toString())
            expect(data.data.overallProgress).toBeDefined()
            expect(data.data.chapterScores).toBeDefined()
        })

        it('devrait rejeter sans syllabusId', async () => {
            const request = createMockRequest()

            const response = await getProfile(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('syllabusId')
        })
    })

    describe('GET /api/self-assessments/concept-history', () => {
        beforeEach(async () => {
            // Soumettre 2 auto-évaluations
            await submit(
                createMockRequest({
                    method: 'POST',
                    body: {
                        examId: exam._id.toString(),
                        conceptAssessments: setup.concepts.map((c: any, i: number) => ({
                            conceptId: c._id.toString(),
                            level: i === 0 ? 2 : 3
                        }))
                    }
                })
            )

            await submit(
                createMockRequest({
                    method: 'POST',
                    body: {
                        examId: exam._id.toString(),
                        conceptAssessments: setup.concepts.map((c: any, i: number) => ({
                            conceptId: c._id.toString(),
                            level: i === 0 ? 4 : 3
                        }))
                    }
                })
            )
        })

        it('devrait récupérer l\'historique d\'un concept', async () => {
            const request = createMockRequest({
                searchParams: {
                    conceptId: setup.concepts[0]._id.toString()
                }
            })

            const response = await getConceptHistory(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data).toHaveLength(2)
            expect(data.data[0].level).toBe(2)
            expect(data.data[1].level).toBe(4)
        })

        it('devrait rejeter sans conceptId', async () => {
            const request = createMockRequest()

            const response = await getConceptHistory(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('conceptId')
        })
    })

    describe('GET /api/self-assessments/class-analytics', () => {
        beforeEach(async () => {
            // Créer 2 autres élèves
            const student2 = await createUser()
            const student3 = await createUser()

            // Ajouter à la classe
            setup.class.students = [student._id, student2._id, student3._id]
            await setup.class.save()

            // Chaque élève fait une auto-évaluation
            for (const s of [student, student2, student3]) {
                mockAuth.mockResolvedValue({
                    user: { id: s._id.toString() }
                })

                await submit(
                    createMockRequest({
                        method: 'POST',
                        body: {
                            examId: exam._id.toString(),
                            conceptAssessments: setup.concepts.map((c: any) => ({
                                conceptId: c._id.toString(),
                                level: Math.floor(Math.random() * 7) // Niveaux aléatoires
                            }))
                        }
                    })
                )
            }
        })

        it('devrait récupérer les analytics de classe', async () => {
            mockAuth.mockResolvedValue({
                user: { id: student._id.toString() }
            })

            const request = createMockRequest({
                searchParams: {
                    chapterId: setup.chapter._id.toString(),
                    classId: setup.class._id.toString()
                }
            })

            const response = await getClassAnalytics(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.totalStudents).toBe(3)
            expect(data.data.averageClassScore).toBeDefined()
            expect(data.data.conceptDifficulty).toHaveLength(4)
        })

        it('devrait rejeter sans chapterId', async () => {
            const request = createMockRequest({
                searchParams: {
                    classId: setup.class._id.toString()
                }
            })

            const response = await getClassAnalytics(request)
            const data = await response.json()

            expect(response.status).toBe(400)
        })

        it('devrait rejeter sans classId', async () => {
            const request = createMockRequest({
                searchParams: {
                    chapterId: setup.chapter._id.toString()
                }
            })

            const response = await getClassAnalytics(request)
            const data = await response.json()

            expect(response.status).toBe(400)
        })
    })
})
