import { SchoolType } from '@/models/School'
import { EvaluationType, Cycle } from '@/models/enums'

/**
 * Interface de stratégie pour les types d'école
 *
 * Définit le comportement spécifique à chaque niveau d'enseignement :
 * - Primaire : focus sur les fondamentaux, évaluations simples
 * - Secondaire : évaluations variées, complexité accrue
 * - Supérieur : examens complexes, dissertations, projets
 */

// ==========================================
// TYPES ET INTERFACES
// ==========================================

/**
 * Configuration par défaut d'un examen selon le type d'école
 */
export interface ExamDefaultConfig {
    /** Durée par défaut en minutes */
    defaultDuration: number
    /** Durée minimale autorisée en minutes */
    minDuration: number
    /** Durée maximale autorisée en minutes */
    maxDuration: number
    /** Note de passage par défaut (%) */
    passingScore: number
    /** Nombre de questions recommandé */
    recommendedQuestionCount: number
    /** Nombre minimum de questions */
    minQuestions: number
    /** Nombre maximum de questions */
    maxQuestions: number
    /** Mélanger les questions par défaut */
    shuffleByDefault: boolean
    /** Afficher les résultats immédiatement */
    showResultsImmediately: boolean
    /** Permettre la révision après l'examen */
    allowReview: boolean
    /** Types d'évaluation autorisés pour ce niveau */
    allowedEvaluationTypes: EvaluationType[]
}

/**
 * Contraintes de validation spécifiques à un type d'école
 */
export interface ValidationConstraints {
    /** Nombre minimum de réponses pour un QCM */
    minAnswersPerQCM: number
    /** Nombre maximum de réponses pour un QCM */
    maxAnswersPerQCM: number
    /** Longueur minimale d'une question ouverte (caractères) */
    minOpenQuestionLength: number
    /** Longueur maximale d'une question ouverte (caractères) */
    maxOpenQuestionLength: number
    /** Autoriser les questions à choix multiples */
    allowMultipleChoice: boolean
    /** Autoriser les questions ouvertes */
    allowOpenQuestions: boolean
    /** Autoriser les examens adaptatifs */
    allowAdaptiveExams: boolean
    /** Autoriser les simulations d'examen */
    allowExamSimulation: boolean
    /** Nombre minimum de concepts à évaluer */
    minConcepts: number
    /** Pourcentage maximum d'une même matière */
    maxSingleSubjectPercentage: number
}

/**
 * Terminologie spécifique à un niveau d'enseignement
 */
export interface LevelTerminology {
    /** Terme pour "examen" */
    examLabel: string
    /** Terme pour "test" */
    testLabel: string
    /** Terme pour "évaluation" */
    evaluationLabel: string
    /** Terme pour "note" */
    gradeLabel: string
    /** Terme pour "étudiant" */
    studentLabel: string
    /** Terme pour "enseignant" */
    teacherLabel: string
    /** Terme pour "matière" */
    subjectLabel: string
    /** Terme pour "classe" */
    classLabel: string
    /** Terme pour "promotion" / "cohorte" */
    cohortLabel: string
    /** Échelle de notation (ex: "sur 20", "sur 100", "A-F") */
    gradingScale: string
    /** Description de l'échelle */
    gradingScaleDescription: string
}

/**
 * Fonctionnalités disponibles selon le type d'école
 */
export interface FeatureAvailability {
    /** QR Code pour rejoindre l'examen */
    qrCodeAccess: boolean
    /** Mode de révision avant l'examen */
    preExamReview: boolean
    /** Statistiques avancées */
    advancedStats: boolean
    /** Analyse par concept */
    conceptAnalysis: boolean
    /** Comparaison avec la classe */
    classComparison: boolean
    /** Recommandations personnalisées */
    personalizedRecommendations: boolean
    /** Export des résultats (PDF, Excel) */
    resultsExport: boolean
    /** Intégration avec le système de notation */
    gradingSystemIntegration: boolean
    /** Certification à la fin */
    certification: boolean
    /** Plagiat detection */
    plagiarismDetection: boolean
    /** Sessions surveillées */
    proctoredSessions: boolean
}

/**
 * Résultat de validation
 */
export interface ValidationResult {
    /** Validation réussie ? */
    isValid: boolean
    /** Liste des erreurs bloquantes */
    errors: string[]
    /** Liste des avertissements (non bloquants) */
    warnings: string[]
}

/**
 * Données d'entrée pour la validation
 */
export interface ExamValidationInput {
    duration: number
    questionCount: number
    evaluationType: EvaluationType
    passingScore: number
    targetLevelIds: string[]
    subjectId?: string
    concepts?: string[]
    hasMultipleChoice?: boolean
    hasOpenQuestions?: boolean
}

// ==========================================
// INTERFACE PRINCIPALE
// ==========================================

/**
 * Interface de stratégie pour un type d'école
 *
 * Chaque implémentation définit les règles spécifiques à un niveau :
 * - PrimaryExamStrategy : École primaire
 * - SecondaryExamStrategy : École secondaire
 * - HigherEdExamStrategy : Enseignement supérieur
 */
export interface ISchoolTypeStrategy {
    /**
     * Type d'école géré par cette stratégie
     */
    readonly schoolType: SchoolType

    /**
     * Nom descriptif du niveau
     */
    readonly levelName: string

    /**
     * Obtenir la configuration par défaut des examens
     */
    getDefaultConfig(): ExamDefaultConfig

    /**
     * Obtenir les contraintes de validation
     */
    getValidationConstraints(): ValidationConstraints

    /**
     * Obtenir la terminologie adaptée au niveau
     */
    getTerminology(): LevelTerminology

    /**
     * Obtenir les fonctionnalités disponibles
     */
    getFeatureAvailability(): FeatureAvailability

    /**
     * Valider un examen selon les contraintes du niveau
     *
     * @param input - Données de l'examen à valider
     * @returns Résultat de la validation avec erreurs et avertissements
     */
    validateExam(input: ExamValidationInput): ValidationResult

    /**
     * Calculer un score de difficulté recommandé (0-100)
     *
     * @param targetLevelIds - Niveaux ciblés
     * @param conceptCount - Nombre de concepts
     * @returns Score de difficulté de 0 (très facile) à 100 (très difficile)
     */
    calculateRecommendedDifficulty(targetLevelIds: string[], conceptCount: number): number

    /**
     * Obtenir des suggestions de configuration
     *
     * @param evaluationType - Type d'évaluation souhaité
     * @returns Suggestions de configuration avec justifications
     */
    getConfigSuggestions(evaluationType: EvaluationType): {
        duration: number
        questionCount: number
        passingScore: number
        rationale: string
    }

    /**
     * Vérifier la compatibilité d'un niveau éducatif avec ce type d'école
     *
     * @param educationLevelId - ID du niveau éducatif
     * @param schoolCycles - Cycles effectivement enseignés dans l'école (optionnel)
     * @returns true si compatible, false sinon
     */
    isEducationLevelCompatible(educationLevelId: string, schoolCycles?: Cycle[]): Promise<boolean>

    /**
     * Obtenir les niveaux éducatifs recommandés pour ce type d'école
     *
     * @returns Liste des IDs de niveaux éducatifs compatibles
     */
    getRecommendedEducationLevels(): Promise<string[]>
}

/**
 * Type d'export pour faciliter l'usage
 */
export type SchoolTypeStrategyType = ISchoolTypeStrategy
