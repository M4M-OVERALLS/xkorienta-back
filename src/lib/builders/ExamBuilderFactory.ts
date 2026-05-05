import { ExamBuilder } from './ExamBuilder'
import {
    getTemplateByExamType,
    getTemplateById,
    getTemplatesByCategory,
    ExamTemplate
} from '@/lib/exam-templates/ExamTemplate'
import { ExamType } from '@/models/enums'

/**
 * ExamBuilderFactory - Factory pour créer des builders préconfigurés
 *
 * Fournit des méthodes de raccourci pour les types d'examens courants
 */
export class ExamBuilderFactory {
    /**
     * Créer un builder à partir d'un template ID
     */
    static fromTemplate(templateId: string): ExamBuilder {
        const template = getTemplateById(templateId)
        if (!template) {
            throw new Error(`Template introuvable : ${templateId}`)
        }
        return new ExamBuilder(template)
    }

    /**
     * Créer un builder à partir d'un ExamType
     */
    static fromExamType(examType: ExamType): ExamBuilder {
        const template = getTemplateByExamType(examType)
        if (!template) {
            throw new Error(`Aucun template pour le type : ${examType}`)
        }
        return new ExamBuilder(template)
    }

    // ========== ÉVALUATIONS DIAGNOSTIQUES ==========

    /**
     * Test de positionnement
     */
    static diagnosticTest(): ExamBuilder {
        return this.fromExamType(ExamType.DIAGNOSTIC_TEST)
    }

    /**
     * Pré-test
     */
    static preTest(): ExamBuilder {
        return this.fromExamType(ExamType.PRE_TEST)
    }

    // ========== ÉVALUATIONS FORMATIVES ==========

    /**
     * Auto-évaluation (7 niveaux par concept)
     */
    static selfAssessment(): ExamBuilder {
        return this.fromExamType(ExamType.SELF_ASSESSMENT)
    }

    /**
     * Quiz formatif avec feedback immédiat
     */
    static formativeQuiz(): ExamBuilder {
        return this.fromExamType(ExamType.FORMATIVE_QUIZ)
    }

    /**
     * Test d'entraînement (tentatives illimitées)
     */
    static practiceTest(): ExamBuilder {
        return this.fromExamType(ExamType.PRACTICE_TEST)
    }

    /**
     * Devoir à la maison
     */
    static homework(): ExamBuilder {
        return this.fromExamType(ExamType.HOMEWORK)
    }

    /**
     * Quiz de révision
     */
    static revisionQuiz(): ExamBuilder {
        return this.fromExamType(ExamType.REVISION_QUIZ)
    }

    // ========== ÉVALUATIONS SOMMATIVES ==========

    /**
     * Interrogation annoncée
     */
    static quizAnnounced(): ExamBuilder {
        return this.fromExamType(ExamType.QUIZ_ANNOUNCED)
    }

    /**
     * Interrogation surprise
     */
    static quizSurprise(): ExamBuilder {
        return this.fromExamType(ExamType.QUIZ_SURPRISE)
    }

    /**
     * Contrôle continu (CC)
     */
    static continuousAssessment(): ExamBuilder {
        return this.fromExamType(ExamType.CONTINUOUS_ASSESSMENT)
    }

    /**
     * Devoir surveillé (DS)
     */
    static supervisedTest(): ExamBuilder {
        return this.fromExamType(ExamType.SUPERVISED_TEST)
    }

    /**
     * Examen de mi-session / Partiel
     */
    static midtermExam(): ExamBuilder {
        return this.fromExamType(ExamType.MIDTERM_EXAM)
    }

    /**
     * Examen final
     */
    static finalExam(): ExamBuilder {
        return this.fromExamType(ExamType.FINAL_EXAM)
    }

    /**
     * Examen de rattrapage
     */
    static retakeExam(): ExamBuilder {
        return this.fromExamType(ExamType.RETAKE_EXAM)
    }

    // ========== ÉVALUATIONS SPÉCIALES ==========

    /**
     * Examen blanc (simulation)
     */
    static mockExam(): ExamBuilder {
        return this.fromExamType(ExamType.MOCK_EXAM)
    }

    /**
     * Travaux pratiques (TP)
     */
    static practicalWork(): ExamBuilder {
        return this.fromExamType(ExamType.PRACTICAL_WORK)
    }

    /**
     * Travaux de laboratoire
     */
    static labWork(): ExamBuilder {
        return this.fromExamType(ExamType.LAB_WORK)
    }

    /**
     * Projet de groupe
     */
    static projectGroup(): ExamBuilder {
        return this.fromExamType(ExamType.PROJECT_GROUP)
    }

    /**
     * Projet individuel
     */
    static projectIndividual(): ExamBuilder {
        return this.fromExamType(ExamType.PROJECT_INDIVIDUAL)
    }

    /**
     * Exposé oral
     */
    static oralPresentation(): ExamBuilder {
        return this.fromExamType(ExamType.ORAL_PRESENTATION)
    }

    /**
     * Soutenance
     */
    static oralDefense(): ExamBuilder {
        return this.fromExamType(ExamType.ORAL_DEFENSE)
    }

    /**
     * Portfolio / Dossier
     */
    static portfolio(): ExamBuilder {
        return this.fromExamType(ExamType.PORTFOLIO)
    }

    /**
     * Étude de cas
     */
    static caseStudy(): ExamBuilder {
        return this.fromExamType(ExamType.CASE_STUDY_EVAL)
    }

    // ========== COMPÉTITIONS ==========

    /**
     * Challenge inter-classes
     */
    static classChallenge(): ExamBuilder {
        return this.fromExamType(ExamType.CLASS_CHALLENGE)
    }

    /**
     * Compétition inter-écoles
     */
    static schoolCompetition(): ExamBuilder {
        return this.fromExamType(ExamType.SCHOOL_COMPETITION)
    }

    /**
     * Olympiade
     */
    static olympiad(): ExamBuilder {
        return this.fromExamType(ExamType.OLYMPIAD)
    }

    // ========== ADAPTATIF ==========

    /**
     * Évaluation adaptative
     */
    static adaptiveAssessment(): ExamBuilder {
        return this.fromExamType(ExamType.ADAPTIVE_ASSESSMENT)
    }

    /**
     * Test personnalisé
     */
    static personalizedTest(): ExamBuilder {
        return this.fromExamType(ExamType.PERSONALIZED_TEST)
    }

    // ========== MÉTHODES UTILITAIRES ==========

    /**
     * Obtenir tous les templates disponibles
     */
    static getAllTemplates(): ExamTemplate[] {
        return getTemplatesByCategory('DIAGNOSTIC')
            .concat(getTemplatesByCategory('FORMATIVE'))
            .concat(getTemplatesByCategory('SUMMATIVE'))
            .concat(getTemplatesByCategory('SPECIAL'))
            .concat(getTemplatesByCategory('COMPETITION'))
            .concat(getTemplatesByCategory('ADAPTIVE'))
    }

    /**
     * Obtenir tous les templates d'une catégorie
     */
    static getTemplatesByCategory(category: 'DIAGNOSTIC' | 'FORMATIVE' | 'SUMMATIVE' | 'SPECIAL' | 'COMPETITION' | 'ADAPTIVE'): ExamTemplate[] {
        return getTemplatesByCategory(category)
    }

    /**
     * Raccourci : créer un examen noté (graded) standard
     * Utilise le template "supervised-test" par défaut
     */
    static gradedExam(): ExamBuilder {
        return this.supervisedTest()
    }

    /**
     * Raccourci : créer un examen non-noté (practice) standard
     * Utilise le template "practice-test" par défaut
     */
    static practiceExam(): ExamBuilder {
        return this.practiceTest()
    }

    /**
     * Raccourci : créer une compétition standard
     * Utilise le template "class-challenge" par défaut
     */
    static competition(): ExamBuilder {
        return this.classChallenge()
    }
}

/**
 * Exemple d'utilisation :
 *
 * // Créer une auto-évaluation
 * const exam = await ExamBuilderFactory.selfAssessment()
 *     .setContext({ schoolId: '...', targetLevelIds: ['...'] })
 *     .setTarget({ subjectId: '...', learningUnitIds: ['...'], linkedConceptIds: [...] })
 *     .setTiming({ startTime: new Date(), endTime: new Date(), duration: 15 })
 *     .setMetadata({ title: 'Auto-évaluation : Chapitre 3' })
 *     .build(userId)
 *
 * // Créer un examen final
 * const finalExam = await ExamBuilderFactory.finalExam()
 *     .setContext({ schoolId: '...', targetLevelIds: ['...'] })
 *     .setTarget({
 *         subjectId: '...',
 *         learningUnitIds: [...], // Tous les chapitres
 *         chapterWeights: [
 *             { learningUnit: 'ch1', weight: 25 },
 *             { learningUnit: 'ch2', weight: 25 },
 *             { learningUnit: 'ch3', weight: 25 },
 *             { learningUnit: 'ch4', weight: 25 }
 *         ]
 *     })
 *     .setTiming({ startTime: new Date(), endTime: new Date(), duration: 180 })
 *     .setMetadata({ title: 'Examen final Mathématiques' })
 *     .customizeConfig({
 *         antiCheat: {
 *             webcamRequired: true,
 *             maxTabSwitches: 0
 *         }
 *     })
 *     .build(userId, true) // true = publish immediately
 *
 * // Sauvegarder un brouillon progressivement
 * const draft = await ExamBuilderFactory.homework()
 *     .setMetadata({ title: 'Devoir Chapitre 5' })
 *     .saveDraft(userId)
 *
 * // Reprendre le brouillon plus tard
 * const builder = new ExamBuilder(getTemplateByExamType(draft.examType!))
 * builder.setContext({ ... })
 * builder.setTarget({ ... })
 * const finalExam = await builder.build(userId, true)
 */
