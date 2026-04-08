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
 * Stratégie pour les examens d'école primaire
 *
 * Caractéristiques :
 * - Examens courts et simples (15-45 min)
 * - QCM privilégiés, questions ouvertes courtes
 * - Évaluations ludiques et encourageantes
 * - Pas d'examens adaptatifs complexes
 * - Focus sur les fondamentaux (lecture, calcul, sciences de base)
 * - Terminologie adaptée aux jeunes élèves
 */
export class PrimaryExamStrategy implements ISchoolTypeStrategy {
    readonly schoolType = SchoolType.PRIMARY
    readonly levelName = 'École Primaire'

    /**
     * Configuration par défaut pour le primaire
     * - Durée courte (30 min par défaut)
     * - Peu de questions (10-15)
     * - Note de passage basse (50%)
     * - Résultats immédiats pour encourager
     */
    getDefaultConfig(): ExamDefaultConfig {
        return {
            defaultDuration: 30,
            minDuration: 15,
            maxDuration: 60,
            passingScore: 50,
            recommendedQuestionCount: 12,
            minQuestions: 5,
            maxQuestions: 25,
            shuffleByDefault: true,
            showResultsImmediately: true,
            allowReview: true,
            allowedEvaluationTypes: [
                EvaluationType.QCM,
                EvaluationType.OPEN_QUESTION,
                EvaluationType.EXAM_SIMULATION
            ]
        }
    }

    /**
     * Contraintes de validation strictes pour le primaire
     * - QCM avec 2-4 réponses (pas trop de choix pour ne pas perdre les enfants)
     * - Questions ouvertes courtes (max 500 caractères)
     * - Pas d'examens adaptatifs complexes
     * - Focus sur une seule matière à la fois
     */
    getValidationConstraints(): ValidationConstraints {
        return {
            minAnswersPerQCM: 2,
            maxAnswersPerQCM: 4,
            minOpenQuestionLength: 10,
            maxOpenQuestionLength: 500,
            allowMultipleChoice: true,
            allowOpenQuestions: true,
            allowAdaptiveExams: false, // Trop complexe pour le primaire
            allowExamSimulation: true,
            minConcepts: 1,
            maxSingleSubjectPercentage: 100 // Une seule matière à la fois
        }
    }

    /**
     * Terminologie adaptée au primaire
     * - Vocabulaire simple et encourageant
     * - "Contrôle" au lieu d'"examen"
     * - "Élève" au lieu d'"étudiant"
     * - Notation sur 10 (traditionnelle au primaire francophone)
     */
    getTerminology(): LevelTerminology {
        return {
            examLabel: 'Contrôle',
            testLabel: 'Mini-test',
            evaluationLabel: 'Évaluation',
            gradeLabel: 'Note',
            studentLabel: 'Élève',
            teacherLabel: 'Maître / Maîtresse',
            subjectLabel: 'Matière',
            classLabel: 'Classe',
            cohortLabel: 'Promotion',
            gradingScale: 'sur 10',
            gradingScaleDescription: 'Note sur 10 (0 = très insuffisant, 10 = excellent)'
        }
    }

    /**
     * Fonctionnalités limitées pour le primaire
     * - Pas de certification officielle
     * - Pas de détection de plagiat
     * - Pas de sessions surveillées
     * - Focus sur l'apprentissage, pas l'évaluation formelle
     */
    getFeatureAvailability(): FeatureAvailability {
        return {
            qrCodeAccess: true,
            preExamReview: true,
            advancedStats: false, // Stats simples suffisent
            conceptAnalysis: true,
            classComparison: true,
            personalizedRecommendations: true,
            resultsExport: false, // Pas nécessaire pour le primaire
            gradingSystemIntegration: true,
            certification: false,
            plagiarismDetection: false,
            proctoredSessions: false
        }
    }

    /**
     * Validation adaptée au primaire
     * - Examens courts obligatoires
     * - Peu de questions
     * - Types d'évaluation limités
     */
    validateExam(input: ExamValidationInput): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []
        const constraints = this.getValidationConstraints()
        const config = this.getDefaultConfig()

        // 1. Validation de la durée
        if (input.duration < config.minDuration) {
            errors.push(`La durée minimale pour un contrôle de primaire est de ${config.minDuration} minutes.`)
        }
        if (input.duration > config.maxDuration) {
            warnings.push(`La durée de ${input.duration} minutes est élevée pour des élèves de primaire. Durée recommandée : ${config.defaultDuration} minutes.`)
        }

        // 2. Validation du nombre de questions
        if (input.questionCount < config.minQuestions) {
            errors.push(`Un contrôle doit avoir au moins ${config.minQuestions} questions.`)
        }
        if (input.questionCount > config.maxQuestions) {
            warnings.push(`${input.questionCount} questions risquent de fatiguer les élèves. Nombre recommandé : ${config.recommendedQuestionCount} questions.`)
        }

        // 3. Validation du type d'évaluation
        if (!config.allowedEvaluationTypes.includes(input.evaluationType)) {
            errors.push(`Le type d'évaluation "${input.evaluationType}" n'est pas adapté au primaire. Types autorisés : ${config.allowedEvaluationTypes.join(', ')}.`)
        }

        // 4. Validation des examens adaptatifs (interdits)
        if (input.evaluationType === EvaluationType.ADAPTIVE && !constraints.allowAdaptiveExams) {
            errors.push('Les examens adaptatifs ne sont pas disponibles pour le primaire. Utilisez un QCM ou une évaluation classique.')
        }

        // 5. Validation de la note de passage
        if (input.passingScore < 40) {
            warnings.push('Une note de passage inférieure à 40% peut être trop facile.')
        }
        if (input.passingScore > 70) {
            warnings.push('Une note de passage supérieure à 70% peut être trop exigeante pour le primaire.')
        }

        // 6. Validation des niveaux ciblés
        if (!input.targetLevelIds || input.targetLevelIds.length === 0) {
            errors.push('Vous devez sélectionner au moins un niveau de classe (CP, CE1, CE2, CM1, CM2).')
        }

        // 7. Validation des concepts
        if (input.concepts && input.concepts.length < constraints.minConcepts) {
            warnings.push(`Il est recommandé d'évaluer au moins ${constraints.minConcepts} concept(s).`)
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Calcul de difficulté pour le primaire
     * - Difficulté plus basse que les autres niveaux
     * - Base : 30-50 (facile à moyen)
     * - Ajustement selon le nombre de concepts
     */
    calculateRecommendedDifficulty(targetLevelIds: string[], conceptCount: number): number {
        // Base : 40 (facile)
        let difficulty = 40

        // Ajustement selon le nombre de concepts (max +20)
        const conceptBonus = Math.min(conceptCount * 3, 20)
        difficulty += conceptBonus

        // Ajustement selon le nombre de niveaux ciblés (multi-niveaux = plus difficile)
        if (targetLevelIds.length > 1) {
            difficulty += 10
        }

        // Plafonner à 70 pour le primaire (jamais "très difficile")
        return Math.min(difficulty, 70)
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
                    duration: 25,
                    questionCount: 15,
                    passingScore: 50,
                    rationale: 'QCM adapté au primaire : 15 questions courtes en 25 minutes. Les élèves ont environ 1m30 par question.'
                }

            case EvaluationType.OPEN_QUESTION:
                return {
                    duration: 40,
                    questionCount: 8,
                    passingScore: 50,
                    rationale: 'Questions ouvertes courtes : 8 questions en 40 minutes. Les élèves ont environ 5 minutes par question pour réfléchir et rédiger.'
                }

            case EvaluationType.EXAM_SIMULATION:
                return {
                    duration: 50,
                    questionCount: 20,
                    passingScore: 55,
                    rationale: 'Simulation d\'examen : 20 questions mixtes (QCM + ouvertes) en 50 minutes. Note de passage légèrement plus élevée (55%).'
                }

            default:
                return {
                    duration: 30,
                    questionCount: 12,
                    passingScore: 50,
                    rationale: 'Configuration par défaut pour le primaire.'
                }
        }
    }

    /**
     * Vérifier la compatibilité d'un niveau éducatif avec ce type d'école
     * Compatible avec : MATERNELLE, PRIMAIRE
     *
     * @param educationLevelId - ID du niveau éducatif
     * @param schoolCycles - Cycles effectivement enseignés dans l'école (optionnel)
     * @returns true si compatible, false sinon
     */
    async isEducationLevelCompatible(educationLevelId: string, schoolCycles?: Cycle[]): Promise<boolean> {
        try {
            const level = await EducationLevel.findById(educationLevelId)
            if (!level) return false

            // Vérifier que le niveau est MATERNELLE ou PRIMAIRE
            if (![Cycle.PRESCOLAIRE, Cycle.PRIMAIRE].includes(level.cycle)) {
                return false
            }

            // Si l'école précise ses cycles, vérifier la compatibilité fine
            if (schoolCycles && schoolCycles.length > 0) {
                return schoolCycles.includes(level.cycle)
            }

            // Sinon, compatible par défaut avec tous les cycles PRIMARY
            return true
        } catch (error) {
            console.error('Erreur lors de la vérification de compatibilité:', error)
            return false
        }
    }

    /**
     * Obtenir les niveaux éducatifs recommandés (CP à CM2)
     */
    async getRecommendedEducationLevels(): Promise<string[]> {
        try {
            const levels = await EducationLevel.find({
                cycle: { $in: [Cycle.PRESCOLAIRE, Cycle.PRIMAIRE] }
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
export const primaryExamStrategy = new PrimaryExamStrategy()
