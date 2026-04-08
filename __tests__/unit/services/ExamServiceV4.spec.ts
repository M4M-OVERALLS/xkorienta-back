/**
 * Tests unitaires pour ExamServiceV4
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'
import { ExamType } from '@/models/enums'
import { createFullSetup, createExamV4 } from '../../helpers/factories'
import Exam from '@/models/Exam'

describe('ExamServiceV4', () => {
    let setup: any

    beforeEach(async () => {
        setup = await createFullSetup()
    })

    describe('Templates', () => {
        it('devrait lister tous les templates', async () => {
            const templates = await ExamServiceV4.listTemplates()

            expect(templates).toBeDefined()
            expect(templates.length).toBeGreaterThan(0)
            expect(templates[0]).toHaveProperty('id')
            expect(templates[0]).toHaveProperty('examType')
            expect(templates[0]).toHaveProperty('defaultConfig')
        })

        it('devrait filtrer par catégorie', async () => {
            const formativeTemplates = await ExamServiceV4.listTemplates({ category: 'FORMATIVE' })

            expect(formativeTemplates.every(t => t.category === 'FORMATIVE')).toBe(true)
        })

        it('devrait récupérer un template spécifique', async () => {
            const template = await ExamServiceV4.getTemplate('self-assessment')

            expect(template).toBeDefined()
            expect(template?.examType).toBe(ExamType.SELF_ASSESSMENT)
        })

        it('devrait retourner null pour un template inexistant', async () => {
            const template = await ExamServiceV4.getTemplate('inexistant')

            expect(template).toBeNull()
        })
    })

    describe('Initialisation', () => {
        it('devrait initialiser un builder avec un template', async () => {
            const result = await ExamServiceV4.initialize(
                {
                    templateId: 'self-assessment',
                    title: 'Test Auto-évaluation'
                },
                setup.user._id.toString()
            )

            expect(result).toBeDefined()
            expect(result.draftId).toBeDefined()
            expect(result.template.examType).toBe(ExamType.SELF_ASSESSMENT)

            // Vérifier que le brouillon existe en base
            const draft = await Exam.findById(result.draftId)
            expect(draft).toBeDefined()
            expect(draft?.title).toBe('Test Auto-évaluation')
            expect(draft?.status).toBe('DRAFT')
        })

        it('devrait échouer avec un template invalide', async () => {
            await expect(
                ExamServiceV4.initialize(
                    { templateId: 'inexistant' },
                    setup.user._id.toString()
                )
            ).rejects.toThrow('Template introuvable')
        })
    })

    describe('Mise à jour du contexte', () => {
        let draftId: string

        beforeEach(async () => {
            const result = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Test' },
                setup.user._id.toString()
            )
            draftId = result.draftId
        })

        it('devrait mettre à jour le contexte avec succès', async () => {
            const result = await ExamServiceV4.updateContext(draftId, {
                schoolId: setup.school._id.toString(),
                targetLevelIds: [setup.level._id.toString()]
            })

            expect(result.success).toBe(true)

            // Vérifier la sauvegarde
            const draft = await Exam.findById(draftId)
            expect(draft?.targetLevels).toHaveLength(1)
        })

        it('devrait valider et retourner des erreurs', async () => {
            const result = await ExamServiceV4.updateContext(draftId, {
                targetLevelIds: [] // Invalide
            })

            expect(result.success).toBe(false)
            expect(result.validation.errors).toContain('Au moins un niveau cible est requis')
        })

        it('devrait échouer avec un draftId invalide', async () => {
            await expect(
                ExamServiceV4.updateContext('invalid-id', {
                    targetLevelIds: [setup.level._id.toString()]
                })
            ).rejects.toThrow('Brouillon introuvable')
        })
    })

    describe('Mise à jour de la cible', () => {
        let draftId: string

        beforeEach(async () => {
            const result = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Test' },
                setup.user._id.toString()
            )
            draftId = result.draftId

            await ExamServiceV4.updateContext(draftId, {
                schoolId: setup.school._id.toString(),
                targetLevelIds: [setup.level._id.toString()]
            })
        })

        it('devrait mettre à jour la cible avec succès', async () => {
            const result = await ExamServiceV4.updateTarget(draftId, {
                subjectId: setup.subject._id.toString(),
                syllabusId: setup.syllabus._id.toString(),
                learningUnitIds: [setup.chapter._id.toString()],
                linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
            })

            expect(result.success).toBe(true)

            const draft = await Exam.findById(draftId)
            expect(draft?.subject.toString()).toBe(setup.subject._id.toString())
            expect(draft?.learningUnits).toHaveLength(1)
            expect(draft?.linkedConcepts).toHaveLength(4)
        })

        it('devrait rejeter une cible sans matière', async () => {
            const result = await ExamServiceV4.updateTarget(draftId, {
                subjectId: ''
            })

            expect(result.success).toBe(false)
            expect(result.validation.errors).toContain('La matière est requise')
        })
    })

    describe('Mise à jour du timing', () => {
        let draftId: string

        beforeEach(async () => {
            const result = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Test' },
                setup.user._id.toString()
            )
            draftId = result.draftId

            await ExamServiceV4.updateContext(draftId, {
                targetLevelIds: [setup.level._id.toString()]
            })

            await ExamServiceV4.updateTarget(draftId, {
                subjectId: setup.subject._id.toString(),
                linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
            })
        })

        it('devrait mettre à jour le timing avec succès', async () => {
            const startTime = new Date('2026-04-10T08:00:00')
            const endTime = new Date('2026-04-17T23:59:59')

            const result = await ExamServiceV4.updateTiming(draftId, {
                startTime,
                endTime,
                duration: 15
            })

            expect(result.success).toBe(true)

            const draft = await Exam.findById(draftId)
            expect(draft?.duration).toBe(15)
        })

        it('devrait rejeter des dates invalides', async () => {
            const result = await ExamServiceV4.updateTiming(draftId, {
                startTime: new Date('2026-04-17'),
                endTime: new Date('2026-04-10'), // Avant startTime
                duration: 15
            })

            expect(result.success).toBe(false)
            expect(result.validation.errors).toContain('La date de fin doit être après la date de début')
        })
    })

    describe('Publication', () => {
        let draftId: string

        beforeEach(async () => {
            const result = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Test Publication' },
                setup.user._id.toString()
            )
            draftId = result.draftId

            await ExamServiceV4.updateContext(draftId, {
                schoolId: setup.school._id.toString(),
                targetLevelIds: [setup.level._id.toString()]
            })

            await ExamServiceV4.updateTarget(draftId, {
                subjectId: setup.subject._id.toString(),
                syllabusId: setup.syllabus._id.toString(),
                learningUnitIds: [setup.chapter._id.toString()],
                linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
            })

            await ExamServiceV4.updateTiming(draftId, {
                startTime: new Date('2026-04-10'),
                endTime: new Date('2026-04-17'),
                duration: 15
            })

            await ExamServiceV4.updateMetadata(draftId, {
                title: 'Test Publication'
            })
        })

        it('devrait publier un brouillon valide', async () => {
            const exam = await ExamServiceV4.publish(draftId)

            expect(exam).toBeDefined()
            expect(exam.status).toBe('PUBLISHED')
            expect(exam.isPublished).toBe(true)
            expect(exam.publishedAt).toBeDefined()
        })

        it('devrait échouer si validation invalide', async () => {
            // Modifier pour rendre invalide
            await ExamServiceV4.updateTiming(draftId, {
                startTime: new Date('2026-04-17'),
                endTime: new Date('2026-04-10'), // Invalide
                duration: 15
            })

            await expect(ExamServiceV4.publish(draftId)).rejects.toThrow('Validation échouée')
        })
    })

    describe('Gestion des brouillons', () => {
        it('devrait lister les brouillons d\'un utilisateur', async () => {
            // Créer 2 brouillons
            await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Draft 1' },
                setup.user._id.toString()
            )
            await ExamServiceV4.initialize(
                { templateId: 'formative-quiz', title: 'Draft 2' },
                setup.user._id.toString()
            )

            const drafts = await ExamServiceV4.listDrafts(setup.user._id.toString())

            expect(drafts).toHaveLength(2)
            expect(drafts[0].createdWithV4).toBe(true)
        })

        it('devrait reprendre un brouillon existant', async () => {
            const { draftId } = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Draft to Resume' },
                setup.user._id.toString()
            )

            await ExamServiceV4.updateContext(draftId, {
                targetLevelIds: [setup.level._id.toString()]
            })

            const result = await ExamServiceV4.resumeDraft(draftId, setup.user._id.toString())

            expect(result.exam).toBeDefined()
            expect(result.exam.title).toBe('Draft to Resume')
            expect(result.validation).toBeDefined()
        })

        it('devrait supprimer un brouillon', async () => {
            const { draftId } = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Draft to Delete' },
                setup.user._id.toString()
            )

            await ExamServiceV4.deleteDraft(draftId, setup.user._id.toString())

            const draft = await Exam.findById(draftId)
            expect(draft).toBeNull()
        })

        it('devrait refuser de supprimer un brouillon d\'un autre utilisateur', async () => {
            const { createUser } = await import('../../helpers/factories')
            const otherUser = await createUser()

            const { draftId } = await ExamServiceV4.initialize(
                { templateId: 'self-assessment', title: 'Draft' },
                setup.user._id.toString()
            )

            await expect(
                ExamServiceV4.deleteDraft(draftId, otherUser._id.toString())
            ).rejects.toThrow('Non autorisé')
        })
    })

    describe('Nettoyage des brouillons anciens', () => {
        it('devrait supprimer les brouillons de plus de 30 jours', async () => {
            // Créer un brouillon ancien
            const oldDraft = await createExamV4(setup.user._id.toString(), {
                status: 'DRAFT',
                updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 jours
            })

            // Créer un brouillon récent
            const recentDraft = await createExamV4(setup.user._id.toString(), {
                status: 'DRAFT'
            })

            const deletedCount = await ExamServiceV4.cleanupOldDrafts()

            expect(deletedCount).toBe(1)

            // Vérifier que seul l'ancien a été supprimé
            const oldExists = await Exam.findById(oldDraft._id)
            const recentExists = await Exam.findById(recentDraft._id)

            expect(oldExists).toBeNull()
            expect(recentExists).toBeDefined()
        })
    })
})
