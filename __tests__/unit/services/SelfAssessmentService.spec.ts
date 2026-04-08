/**
 * Tests unitaires pour SelfAssessmentService
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { SelfAssessmentService } from '@/lib/services/SelfAssessmentService'
import { ExamType, SelfAssessmentLevel, ExamStatus } from '@/models/enums'
import { createFullSetup, createExamV4, createUser } from '../../helpers/factories'
import SelfAssessmentResult from '@/models/SelfAssessmentResult'
import Exam from '@/models/Exam'

describe('SelfAssessmentService', () => {
    let setup: any
    let exam: any
    let student: any

    beforeEach(async () => {
        setup = await createFullSetup()
        student = setup.user

        // Créer un examen d'auto-évaluation
        exam = await createExamV4(setup.user._id.toString(), {
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

    describe('Soumission', () => {
        it('devrait soumettre une auto-évaluation valide', async () => {
            const result = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: SelfAssessmentLevel.PERFECTLY_ABLE },
                    { conceptId: setup.concepts[1]._id.toString(), level: SelfAssessmentLevel.ABLE_WITH_HELP },
                    { conceptId: setup.concepts[2]._id.toString(), level: SelfAssessmentLevel.UNABLE_ALONE },
                    { conceptId: setup.concepts[3]._id.toString(), level: SelfAssessmentLevel.UNABLE_WITH_HELP }
                ]
            })

            expect(result).toBeDefined()
            expect(result.result).toBeDefined()
            expect(result.competencyMap).toBeDefined()
            expect(result.recommendations).toBeDefined()

            // Vérifier le résultat
            expect(result.result.totalConcepts).toBe(4)
            expect(result.result.masteredConcepts).toBe(1) // Niveau 6
            expect(result.result.inProgressConcepts).toBe(2) // Niveaux 4 et 3
            expect(result.result.strugglingConcepts).toBe(1) // Niveau 2
            expect(result.result.overallScore).toBeCloseTo(3.75, 2) // (6+4+3+2)/4
        })

        it('devrait calculer automatiquement les statistiques', async () => {
            const { result } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 6 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 3 }
                ]
            })

            expect(result.overallScore).toBeCloseTo(4.5, 2)
            expect(result.masteredConcepts).toBe(2) // 6 et 5
            expect(result.inProgressConcepts).toBe(2) // 4 et 3
        })

        it('devrait échouer si examen inexistant', async () => {
            await expect(
                SelfAssessmentService.submit({
                    examId: '000000000000000000000000',
                    studentId: student._id.toString(),
                    conceptAssessments: []
                })
            ).rejects.toThrow('Examen introuvable')
        })

        it('devrait échouer si pas de type SELF_ASSESSMENT', async () => {
            const normalExam = await createExamV4(student._id.toString(), {
                examType: ExamType.FORMATIVE_QUIZ
            })

            await expect(
                SelfAssessmentService.submit({
                    examId: normalExam._id.toString(),
                    studentId: student._id.toString(),
                    conceptAssessments: []
                })
            ).rejects.toThrow('n\'est pas une auto-évaluation')
        })

        it('devrait échouer si concepts manquants (requireAllConcepts=true)', async () => {
            await expect(
                SelfAssessmentService.submit({
                    examId: exam._id.toString(),
                    studentId: student._id.toString(),
                    conceptAssessments: [
                        { conceptId: setup.concepts[0]._id.toString(), level: 6 }
                        // Manque 3 concepts
                    ]
                })
            ).rejects.toThrow('Vous devez évaluer tous les concepts')
        })

        it('devrait incrémenter le numéro de tentative', async () => {
            // Première tentative
            const { result: result1 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any) => ({
                    conceptId: c._id.toString(),
                    level: 3
                }))
            })

            expect(result1.attemptNumber).toBe(1)

            // Deuxième tentative
            const { result: result2 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any) => ({
                    conceptId: c._id.toString(),
                    level: 4
                }))
            })

            expect(result2.attemptNumber).toBe(2)
        })
    })

    describe('Cartographie des compétences', () => {
        let resultId: string

        beforeEach(async () => {
            const { result } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 6 }, // Fort
                    { conceptId: setup.concepts[1]._id.toString(), level: 4 }, // Modéré
                    { conceptId: setup.concepts[2]._id.toString(), level: 2 }, // Faible
                    { conceptId: setup.concepts[3]._id.toString(), level: 0 }  // Inconnu
                ]
            })
            resultId = result._id.toString()
        })

        it('devrait générer une cartographie correcte', async () => {
            const map = await SelfAssessmentService.generateCompetencyMap(resultId)

            expect(map.strongConcepts).toHaveLength(1)
            expect(map.moderateConcepts).toHaveLength(1)
            expect(map.weakConcepts).toHaveLength(1)
            expect(map.unknownConcepts).toHaveLength(1)

            expect(map.strongConcepts[0].level).toBe(6)
            expect(map.moderateConcepts[0].level).toBe(4)
            expect(map.weakConcepts[0].level).toBe(2)
            expect(map.unknownConcepts[0].level).toBe(0)
        })

        it('devrait regrouper correctement les niveaux', async () => {
            const { result } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 3 }
                ]
            })

            const map = await SelfAssessmentService.generateCompetencyMap(result._id.toString())

            expect(map.strongConcepts).toHaveLength(2) // Niveaux 5 et 6
            expect(map.moderateConcepts).toHaveLength(2) // Niveaux 3 et 4
            expect(map.weakConcepts).toHaveLength(0)
            expect(map.unknownConcepts).toHaveLength(0)
        })
    })

    describe('Recommandations', () => {
        it('devrait générer des recommandations pour bon niveau', async () => {
            const { result } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any) => ({
                    conceptId: c._id.toString(),
                    level: 5 // Tous à 5
                }))
            })

            const reco = await SelfAssessmentService.generateRecommendations(result._id.toString())

            expect(reco.nextChapterReady).toBe(true) // Score >= 70% au niveau 4+
            expect(reco.conceptsToFocus).toHaveLength(0) // Aucun concept < 3
            expect(reco.message).toContain('🌟')
        })

        it('devrait identifier les concepts à retravailler', async () => {
            const { result } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 1 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 0 }
                ]
            })

            const reco = await SelfAssessmentService.generateRecommendations(result._id.toString())

            expect(reco.conceptsToFocus.length).toBeGreaterThan(0)
            // Les concepts sont triés par niveau (plus faibles en premier)
        })

        it('devrait indiquer si prêt pour le chapitre suivant', async () => {
            // Cas 1: Prêt (75% au niveau 4+)
            const { result: result1 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 2 }
                ]
            })

            const reco1 = await SelfAssessmentService.generateRecommendations(result1._id.toString())
            expect(reco1.nextChapterReady).toBe(true)

            // Cas 2: Pas prêt (< 70% au niveau 4+)
            const student2 = await createUser()
            const { result: result2 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student2._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 1 }
                ]
            })

            const reco2 = await SelfAssessmentService.generateRecommendations(result2._id.toString())
            expect(reco2.nextChapterReady).toBe(false)
        })
    })

    describe('Historique de progression', () => {
        it('devrait tracer l\'évolution d\'un concept', async () => {
            const conceptId = setup.concepts[0]._id.toString()

            // Tentative 1
            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any, i: number) => ({
                    conceptId: c._id.toString(),
                    level: i === 0 ? 2 : 3
                }))
            })

            // Tentative 2
            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any, i: number) => ({
                    conceptId: c._id.toString(),
                    level: i === 0 ? 4 : 3
                }))
            })

            // Tentative 3
            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: setup.concepts.map((c: any, i: number) => ({
                    conceptId: c._id.toString(),
                    level: i === 0 ? 5 : 3
                }))
            })

            const history = await SelfAssessmentService.getConceptHistory(
                student._id.toString(),
                conceptId
            )

            expect(history).toHaveLength(3)
            expect(history[0].level).toBe(2)
            expect(history[1].level).toBe(4)
            expect(history[2].level).toBe(5)
            // Progression positive !
        })
    })

    describe('Analytics classe', () => {
        it('devrait calculer les statistiques de classe', async () => {
            // Créer 3 élèves
            const students = await Promise.all([
                createUser(),
                createUser(),
                createUser()
            ])

            // Chaque élève fait une auto-évaluation
            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: students[0]._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 6 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 3 }
                ]
            })

            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: students[1]._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 1 }
                ]
            })

            await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: students[2]._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 5 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 2 }
                ]
            })

            const analytics = await SelfAssessmentService.getClassAnalytics(
                setup.chapter._id.toString(),
                students.map(s => s._id.toString())
            )

            expect(analytics.totalStudents).toBe(3)
            expect(analytics.averageClassScore).toBeCloseTo(3.5, 1) // Moyenne globale
            expect(analytics.conceptDifficulty).toHaveLength(4)

            // Vérifier la distribution pour le concept 0
            const concept0Stats = analytics.conceptDifficulty.find(
                (c: any) => c.concept._id.toString() === setup.concepts[0]._id.toString()
            )
            expect(concept0Stats.averageLevel).toBeCloseTo(5, 1) // (6+4+5)/3
        })

        it('devrait identifier les concepts à revoir en classe', async () => {
            const students = await Promise.all([createUser(), createUser()])

            // Tous en difficulté sur le concept 3
            await Promise.all(
                students.map(s =>
                    SelfAssessmentService.submit({
                        examId: exam._id.toString(),
                        studentId: s._id.toString(),
                        conceptAssessments: [
                            { conceptId: setup.concepts[0]._id.toString(), level: 5 },
                            { conceptId: setup.concepts[1]._id.toString(), level: 5 },
                            { conceptId: setup.concepts[2]._id.toString(), level: 5 },
                            { conceptId: setup.concepts[3]._id.toString(), level: 2 } // Difficile
                        ]
                    })
                )
            )

            const analytics = await SelfAssessmentService.getClassAnalytics(
                setup.chapter._id.toString(),
                students.map(s => s._id.toString())
            )

            expect(analytics.conceptsNeedingReview.length).toBeGreaterThan(0)
            const difficult = analytics.conceptsNeedingReview.find(
                (c: any) => c.concept._id.toString() === setup.concepts[3]._id.toString()
            )
            expect(difficult).toBeDefined()
            expect(difficult.averageLevel).toBeLessThan(3.5)
        })
    })

    describe('Comparaison de résultats', () => {
        it('devrait comparer deux auto-évaluations', async () => {
            // Première auto-évaluation
            const { result: result1 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 2 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 1 }
                ]
            })

            // Deuxième auto-évaluation (amélioration)
            const { result: result2 } = await SelfAssessmentService.submit({
                examId: exam._id.toString(),
                studentId: student._id.toString(),
                conceptAssessments: [
                    { conceptId: setup.concepts[0]._id.toString(), level: 4 },
                    { conceptId: setup.concepts[1]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[2]._id.toString(), level: 3 },
                    { conceptId: setup.concepts[3]._id.toString(), level: 2 }
                ]
            })

            const comparison = await SelfAssessmentService.compareResults(
                result1._id.toString(),
                result2._id.toString()
            )

            expect(comparison.previous.overallScore).toBeCloseTo(2, 1)
            expect(comparison.current.overallScore).toBeCloseTo(3, 1)
            expect(comparison.progression.scoreDifference).toBeGreaterThan(0)
            expect(comparison.progression.improved).toBe(3) // 3 concepts améliorés
            expect(comparison.progression.stagnated).toBe(1) // 1 concept stable
            expect(comparison.progression.regressed).toBe(0)
        })
    })
})
