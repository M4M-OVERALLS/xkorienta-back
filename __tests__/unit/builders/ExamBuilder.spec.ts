/**
 * Tests unitaires pour ExamBuilder
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { ExamBuilder } from '@/lib/builders/ExamBuilder'
import { getTemplateById } from '@/lib/exam-templates/ExamTemplate'
import { ExamType } from '@/models/enums'
import { createFullSetup } from '../../helpers/factories'

describe('ExamBuilder', () => {
    let setup: any
    let builder: ExamBuilder

    beforeEach(async () => {
        setup = await createFullSetup()
        const template = getTemplateById('self-assessment')!
        builder = new ExamBuilder(template)
    })

    describe('Construction fluente', () => {
        it('devrait permettre de chaîner les méthodes', () => {
            const result = builder
                .setContext({
                    schoolId: setup.school._id.toString(),
                    targetLevelIds: [setup.level._id.toString()]
                })
                .setTarget({
                    subjectId: setup.subject._id.toString(),
                    syllabusId: setup.syllabus._id.toString()
                })
                .setTiming({
                    startTime: new Date('2026-04-10'),
                    endTime: new Date('2026-04-17'),
                    duration: 15
                })
                .setMetadata({
                    title: 'Test Auto-évaluation'
                })

            expect(result).toBe(builder)
        })
    })

    describe('Validation du contexte', () => {
        it('devrait valider un contexte valide', async () => {
            builder.setContext({
                schoolId: setup.school._id.toString(),
                targetLevelIds: [setup.level._id.toString()]
            })

            const validation = await builder.validate()
            expect(validation.valid).toBe(false) // Car manque target et timing
            expect(validation.errors).not.toContain(expect.stringContaining('contexte'))
        })

        it('devrait rejeter un contexte sans niveaux cibles', async () => {
            builder.setContext({
                schoolId: setup.school._id.toString(),
                targetLevelIds: []
            })

            const validation = await builder.validate()
            expect(validation.errors).toContain('Au moins un niveau cible est requis')
        })

        it('devrait détecter une incompatibilité école-niveau', async () => {
            // Créer un niveau LYCEE pour une école COLLEGE uniquement
            const { createSchool, createEducationLevel } = await import('../../helpers/factories')
            const collegeOnlySchool = await createSchool({
                type: 'SECONDARY',
                cycles: ['COLLEGE'] // Seulement collège
            })
            const lyceeLevel = await createEducationLevel({
                name: '2nde',
                cycle: 'LYCEE'
            })

            builder.setContext({
                schoolId: collegeOnlySchool._id.toString(),
                targetLevelIds: [lyceeLevel._id.toString()],
                schoolCycles: ['COLLEGE']
            })

            const validation = await builder.validate()
            expect(validation.errors.some(e => e.includes('n\'est pas enseigné dans cette école'))).toBe(true)
        })
    })

    describe('Validation de la cible', () => {
        beforeEach(() => {
            builder.setContext({
                schoolId: setup.school._id.toString(),
                targetLevelIds: [setup.level._id.toString()]
            })
        })

        it('devrait valider une cible valide', async () => {
            builder.setTarget({
                subjectId: setup.subject._id.toString(),
                syllabusId: setup.syllabus._id.toString(),
                learningUnitIds: [setup.chapter._id.toString()],
                linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
            })

            const validation = await builder.validate()
            expect(validation.errors).not.toContain(expect.stringContaining('matière'))
        })

        it('devrait rejeter une cible sans matière', async () => {
            builder.setTarget({
                subjectId: '',
                syllabusId: setup.syllabus._id.toString()
            })

            const validation = await builder.validate()
            expect(validation.errors).toContain('La matière est requise')
        })

        it('devrait avertir si auto-évaluation sans concepts', async () => {
            builder.setTarget({
                subjectId: setup.subject._id.toString(),
                learningUnitIds: [setup.chapter._id.toString()],
                linkedConceptIds: [] // Pas de concepts
            })

            const validation = await builder.validate()
            expect(validation.errors).toContain('L\'auto-évaluation nécessite des concepts liés')
        })

        it('devrait vérifier la somme des pondérations', async () => {
            builder.setTarget({
                subjectId: setup.subject._id.toString(),
                learningUnitIds: [setup.chapter._id.toString()],
                chapterWeights: [
                    { learningUnit: setup.chapter._id as any, weight: 60 } // Somme != 100
                ]
            })

            const validation = await builder.validate()
            expect(validation.errors.some(e => e.includes('somme des pondérations'))).toBe(true)
        })
    })

    describe('Validation du timing', () => {
        beforeEach(() => {
            builder
                .setContext({
                    schoolId: setup.school._id.toString(),
                    targetLevelIds: [setup.level._id.toString()]
                })
                .setTarget({
                    subjectId: setup.subject._id.toString(),
                    linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
                })
        })

        it('devrait valider un timing valide', async () => {
            builder.setTiming({
                startTime: new Date('2026-04-10T08:00:00'),
                endTime: new Date('2026-04-17T23:59:59'),
                duration: 15
            })

            const validation = await builder.validate()
            expect(validation.errors).not.toContain(expect.stringContaining('timing'))
        })

        it('devrait rejeter une date de fin avant la date de début', async () => {
            builder.setTiming({
                startTime: new Date('2026-04-17'),
                endTime: new Date('2026-04-10'), // Avant startTime
                duration: 15
            })

            const validation = await builder.validate()
            expect(validation.errors).toContain('La date de fin doit être après la date de début')
        })

        it('devrait rejeter une durée négative', async () => {
            builder.setTiming({
                startTime: new Date('2026-04-10'),
                endTime: new Date('2026-04-17'),
                duration: -10
            })

            const validation = await builder.validate()
            expect(validation.errors).toContain('La durée doit être positive')
        })

        it('devrait avertir si durée trop courte', async () => {
            builder.setTiming({
                startTime: new Date('2026-04-10'),
                endTime: new Date('2026-04-17'),
                duration: 3 // Très court pour une auto-évaluation (recommandé: 15 min)
            })

            const validation = await builder.validate()
            expect(validation.warnings.some(w => w.includes('durée semble courte'))).toBe(true)
        })
    })

    describe('Construction complète', () => {
        beforeEach(() => {
            builder
                .setContext({
                    schoolId: setup.school._id.toString(),
                    targetLevelIds: [setup.level._id.toString()]
                })
                .setTarget({
                    subjectId: setup.subject._id.toString(),
                    syllabusId: setup.syllabus._id.toString(),
                    learningUnitIds: [setup.chapter._id.toString()],
                    linkedConceptIds: setup.concepts.map((c: any) => c._id.toString())
                })
                .setTiming({
                    startTime: new Date('2026-04-10T08:00:00'),
                    endTime: new Date('2026-04-17T23:59:59'),
                    duration: 15
                })
                .setMetadata({
                    title: 'Auto-évaluation : Chapitre 3',
                    description: 'Test description'
                })
        })

        it('devrait construire un examen valide', async () => {
            const exam = await builder.build(setup.user._id.toString(), false)

            expect(exam).toBeDefined()
            expect(exam.title).toBe('Auto-évaluation : Chapitre 3')
            expect(exam.examType).toBe(ExamType.SELF_ASSESSMENT)
            expect(exam.createdWithV4).toBe(true)
            expect(exam.status).toBe('DRAFT')
            expect(exam.learningUnits).toHaveLength(1)
            expect(exam.linkedConcepts).toHaveLength(4)
        })

        it('devrait publier directement si demandé', async () => {
            const exam = await builder.build(setup.user._id.toString(), true)

            expect(exam.status).toBe('PUBLISHED')
            expect(exam.isPublished).toBe(true)
            expect(exam.publishedAt).toBeDefined()
        })

        it('devrait échouer si validation invalide', async () => {
            builder.setMetadata({ title: '' }) // Titre vide

            await expect(builder.build(setup.user._id.toString())).rejects.toThrow('Validation échouée')
        })
    })

    describe('Sauvegarde de brouillon', () => {
        it('devrait sauvegarder un brouillon incomplet', async () => {
            builder.setMetadata({
                title: 'Brouillon test'
            })

            const draft = await builder.saveDraft(setup.user._id.toString())

            expect(draft).toBeDefined()
            expect(draft.title).toBe('Brouillon test')
            expect(draft.status).toBe('DRAFT')
            expect(draft.createdWithV4).toBe(true)
        })

        it('devrait échouer sans titre', async () => {
            await expect(builder.saveDraft(setup.user._id.toString())).rejects.toThrow('titre est requis')
        })
    })
})
