import { SchoolType } from '@/models/School'
import { EvaluationType, Cycle } from '@/models/enums'
import EducationLevel from '@/models/EducationLevel'
import {
    ISchoolTypeStrategy,
    ExamDefaultConfig,
    ValidationConstraints,
    LevelTerminology,
    FeatureAvailability,
    ValidationResult,
    ExamValidationInput
} from './ISchoolTypeStrategy'

/**
 * Stratégie pour les examens d'enseignement supérieur
 *
 * Caractéristiques :
 * - Examens longs et complexes (60-240 min)
 * - Tous types d'évaluation (QCM, dissertations, projets, examens adaptatifs)
 * - Évaluations académiques rigoureuses
 * - Détection de plagiat
 * - Sessions surveillées possibles (examens à distance)
 * - Certification officielle (diplômes, attestations)
 * - Terminologie universitaire (étudiant, UE, ECTS, semestre, crédit)
 * - Notation sur 20 ou sur 100 selon le système
 */
export class HigherEdExamStrategy implements ISchoolTypeStrategy {
    readonly schoolType = SchoolType.HIGHER_ED
    readonly levelName = 'Enseignement Supérieur'

    /**
     * Configuration par défaut pour l'enseignement supérieur
     * - Durée longue (120 min par défaut)
     * - Nombre élevé de questions (30-40)
     * - Note de passage standard (50%)
     * - Résultats différés (correction manuelle possible)
     * - Tous types d'évaluation disponibles
     */
    getDefaultConfig(): ExamDefaultConfig {
        return {
            defaultDuration: 120,
            minDuration: 45,
            maxDuration: 300, // Jusqu'à 5 heures pour les examens complexes
            passingScore: 50,
            recommendedQuestionCount: 35,
            minQuestions: 10,
            maxQuestions: 100,
            shuffleByDefault: true,
            showResultsImmediately: false, // Correction différée (souvent manuelle)
            allowReview: true,
            allowedEvaluationTypes: [
                EvaluationType.QCM,
                EvaluationType.OPEN_QUESTION,
                EvaluationType.ADAPTIVE,
                EvaluationType.EXAM_SIMULATION
            ]
        }
    }

    /**
     * Contraintes de validation pour l'enseignement supérieur
     * - QCM avec 2-8 réponses (questions complexes)
     * - Questions ouvertes très longues (dissertations, études de cas)
     * - Examens adaptatifs autorisés
     * - Examens pluridisciplinaires possibles
     */
    getValidationConstraints(): ValidationConstraints {
        return {
            minAnswersPerQCM: 2,
            maxAnswersPerQCM: 8,
            minOpenQuestionLength: 50,
            maxOpenQuestionLength: 20000, // Dissertations très longues, études de cas
            allowMultipleChoice: true,
            allowOpenQuestions: true,
            allowAdaptiveExams: true,
            allowExamSimulation: true,
            minConcepts: 3,
            maxSingleSubjectPercentage: 70 // Examens souvent pluridisciplinaires
        }
    }

    /**
     * Terminologie universitaire
     * - Vocabulaire académique avancé
     * - "Examen", "Épreuve", "Contrôle continu", "Partiel", "Session"
     * - "Étudiant" (pas "élève")
     * - Notation sur 20 (système camerounais) ou sur 100 (système anglo-saxon)
     * - Références aux UE, ECTS, crédits, semestres
     */
    getTerminology(): LevelTerminology {
        return {
            examLabel: 'Examen',
            testLabel: 'Contrôle',
            evaluationLabel: 'Épreuve',
            gradeLabel: 'Note / Score',
            studentLabel: 'Étudiant(e)',
            teacherLabel: 'Enseignant / Professeur',
            subjectLabel: 'Unité d\'Enseignement (UE)',
            classLabel: 'Promotion / Niveau',
            cohortLabel: 'Cohorte / Promotion',
            gradingScale: 'sur 20 ou sur 100',
            gradingScaleDescription: 'Notation sur 20 (système francophone) ou sur 100 (système anglo-saxon). Mention : 10-11.99 = passable, 12-13.99 = assez bien, 14-15.99 = bien, 16-20 = très bien'
        }
    }

    /**
     * Fonctionnalités avancées pour l'enseignement supérieur
     * - Tout est disponible (certifications officielles, plagiat, sessions surveillées)
     * - Export des résultats pour transcripts académiques
     * - Intégration avec le système de gestion académique
     * - Statistiques avancées et analytics
     */
    getFeatureAvailability(): FeatureAvailability {
        return {
            qrCodeAccess: true,
            preExamReview: true,
            advancedStats: true,
            conceptAnalysis: true,
            classComparison: true,
            personalizedRecommendations: true,
            resultsExport: true, // Export pour transcripts
            gradingSystemIntegration: true,
            certification: true, // Diplômes et attestations officiels
            plagiarismDetection: true, // Obligatoire pour le supérieur
            proctoredSessions: true // Examens surveillés à distance
        }
    }

    /**
     * Validation adaptée à l'enseignement supérieur
     * - Examens longs autorisés (jusqu'à 5 heures)
     * - Grande flexibilité sur le nombre de questions
     * - Validation stricte pour les examens officiels
     */
    validateExam(input: ExamValidationInput): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []
        const constraints = this.getValidationConstraints()
        const config = this.getDefaultConfig()

        // 1. Validation de la durée
        if (input.duration < config.minDuration) {
            errors.push(`La durée minimale pour un examen universitaire est de ${config.minDuration} minutes.`)
        }
        if (input.duration > config.maxDuration) {
            warnings.push(`La durée de ${input.duration} minutes est exceptionnellement longue (> 5h). Assurez-vous que cela correspond à un examen officiel (type session finale).`)
        }

        // 2. Validation du nombre de questions
        if (input.questionCount < config.minQuestions) {
            errors.push(`Un examen universitaire doit avoir au moins ${config.minQuestions} questions.`)
        }
        if (input.questionCount > config.maxQuestions) {
            warnings.push(`${input.questionCount} questions est un nombre extrêmement élevé. Vérifiez que la durée de l'examen est suffisante.`)
        }

        // 3. Validation du type d'évaluation
        if (!config.allowedEvaluationTypes.includes(input.evaluationType)) {
            errors.push(`Le type d'évaluation "${input.evaluationType}" n'est pas autorisé.`)
        }

        // 4. Cohérence durée/nombre de questions
        const avgTimePerQuestion = input.duration / input.questionCount

        if (input.evaluationType === EvaluationType.QCM && avgTimePerQuestion < 1.5) {
            warnings.push(`Temps moyen par question (${avgTimePerQuestion.toFixed(1)} min) très court pour un QCM universitaire. Recommandé : 2-4 minutes par question pour des questions complexes.`)
        }

        if (input.evaluationType === EvaluationType.OPEN_QUESTION && avgTimePerQuestion < 10) {
            warnings.push(`Temps moyen par question (${avgTimePerQuestion.toFixed(1)} min) peut être insuffisant pour des dissertations universitaires. Recommandé : 15-30 minutes par question.`)
        }

        // 5. Validation de la note de passage
        if (input.passingScore < 40) {
            warnings.push('Une note de passage inférieure à 40% (8/20) est en dessous des standards académiques universitaires.')
        }
        if (input.passingScore > 70) {
            warnings.push('Une note de passage supérieure à 70% (14/20) est très exigeante. Assurez-vous que cela correspond à vos critères de certification.')
        }

        // 6. Validation des niveaux ciblés
        if (!input.targetLevelIds || input.targetLevelIds.length === 0) {
            errors.push('Vous devez sélectionner au moins un niveau universitaire (Licence 1-3, Master 1-2, Doctorat).')
        }

        // 7. Validation des concepts
        if (input.concepts && input.concepts.length < constraints.minConcepts) {
            warnings.push(`Il est recommandé d'évaluer au moins ${constraints.minConcepts} concepts pour un examen universitaire.`)
        }

        // 8. Validation de la matière (obligatoire pour le supérieur)
        if (!input.subjectId) {
            errors.push('La spécification d\'une matière (UE) est obligatoire pour un examen universitaire.')
        }

        // 9. Recommandations spécifiques au supérieur
        if (input.evaluationType === EvaluationType.OPEN_QUESTION && !input.hasOpenQuestions) {
            warnings.push('Pour un examen de type "Questions ouvertes", assurez-vous d\'activer la détection de plagiat.')
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Calcul de difficulté pour l'enseignement supérieur
     * - Difficulté élevée par défaut
     * - Base : 65-85 (difficile à très difficile)
     * - Ajustement selon le nombre de concepts et le niveau
     */
    calculateRecommendedDifficulty(targetLevelIds: string[], conceptCount: number): number {
        // Base : 70 (difficile)
        let difficulty = 70

        // Ajustement selon le nombre de concepts (max +20)
        const conceptBonus = Math.min(conceptCount * 3, 20)
        difficulty += conceptBonus

        // Ajustement selon le nombre de niveaux ciblés (multi-niveaux = plus complexe)
        if (targetLevelIds.length > 2) {
            difficulty += 10
        }

        // Plafonner à 100 pour le supérieur (difficulté maximale possible)
        return Math.min(difficulty, 100)
    }

    /**
     * Suggestions de configuration selon le type d'évaluation
     */
    getConfigSuggestions(evaluationType: EvaluationType): {
        duration: number
        questionCount: number
        passingScore: number
        rationale: string
    } {
        switch (evaluationType) {
            case EvaluationType.QCM:
                return {
                    duration: 90,
                    questionCount: 40,
                    passingScore: 50,
                    rationale: 'QCM universitaire : 40 questions en 90 minutes. Questions complexes avec environ 2-3 minutes par question.'
                }

            case EvaluationType.OPEN_QUESTION:
                return {
                    duration: 180,
                    questionCount: 6,
                    passingScore: 50,
                    rationale: 'Questions ouvertes type dissertation universitaire : 6 questions en 3 heures. Les étudiants ont environ 30 minutes par question pour développer.'
                }

            case EvaluationType.ADAPTIVE:
                return {
                    duration: 120,
                    questionCount: 30,
                    passingScore: 55,
                    rationale: 'Examen adaptatif universitaire : 30 questions en 2 heures. La difficulté s\'adapte au niveau de l\'étudiant. Note de passage légèrement plus élevée (55%).'
                }

            case EvaluationType.EXAM_SIMULATION:
                return {
                    duration: 240,
                    questionCount: 50,
                    passingScore: 50,
                    rationale: 'Simulation d\'examen final : 50 questions mixtes en 4 heures. Format proche des épreuves de session (partiel/final).'
                }

            default:
                return {
                    duration: 120,
                    questionCount: 35,
                    passingScore: 50,
                    rationale: 'Configuration par défaut pour l\'enseignement supérieur.'
                }
        }
    }

    /**
     * Vérifier la compatibilité d'un niveau éducatif avec ce type d'école
     * Compatible avec : SUPERIEUR (Licence, Master, Doctorat)
     *
     * @param educationLevelId - ID du niveau éducatif
     * @param schoolCycles - Cycles effectivement enseignés dans l'école (optionnel)
     * @returns true si compatible, false sinon
     */
    async isEducationLevelCompatible(educationLevelId: string, schoolCycles?: Cycle[]): Promise<boolean> {
        try {
            const level = await EducationLevel.findById(educationLevelId)
            if (!level) return false

            // Vérifier que le niveau est SUPERIEUR, LICENCE ou MASTER
            if (![Cycle.SUPERIEUR, Cycle.LICENCE, Cycle.MASTER].includes(level.cycle)) {
                return false
            }

            // Si l'école précise ses cycles, vérifier la compatibilité fine
            if (schoolCycles && schoolCycles.length > 0) {
                return schoolCycles.includes(level.cycle)
            }

            // Sinon, compatible par défaut avec tous les cycles HIGHER_ED
            return true
        } catch (error) {
            console.error('Erreur lors de la vérification de compatibilité:', error)
            return false
        }
    }

    /**
     * Obtenir les niveaux éducatifs recommandés (Licence, Master, Doctorat)
     */
    async getRecommendedEducationLevels(): Promise<string[]> {
        try {
            const levels = await EducationLevel.find({
                cycle: { $in: [Cycle.SUPERIEUR, Cycle.LICENCE, Cycle.MASTER] }
            }).select('_id')

            return levels.map(level => level._id.toString())
        } catch (error) {
            console.error('Erreur lors de la récupération des niveaux recommandés:', error)
            return []
        }
    }
}

/**
 * Instance singleton pour usage global
 */
export const higherEdExamStrategy = new HigherEdExamStrategy()
