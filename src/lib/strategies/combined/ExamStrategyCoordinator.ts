import { IExam } from '@/models/Exam'
import { EvaluationType } from '@/models/enums'
import { ISchoolTypeStrategy, ValidationResult, ExamValidationInput } from '../school-type/ISchoolTypeStrategy'
import { EvaluationStrategy, EvaluationResult } from '@/lib/patterns/EvaluationStrategy'
import { SchoolTypeStrategyContext } from '../school-type/SchoolTypeStrategyContext'
import { EvaluationStrategyFactory } from '@/lib/patterns/EvaluationStrategy'

/**
 * Coordinateur des stratégies d'examen
 *
 * Orchestre les 2 dimensions :
 * - Dimension 1 : Type d'école (PRIMARY, SECONDARY, HIGHER_ED)
 * - Dimension 2 : Type d'évaluation (QCM, OPEN_QUESTION, ADAPTIVE, EXAM_SIMULATION)
 *
 * Pattern : Strategy + Coordinator
 *
 * Responsabilités :
 * 1. Valider un examen selon les contraintes du type d'école
 * 2. Évaluer les réponses selon le type d'évaluation
 * 3. Combiner les deux stratégies de manière cohérente
 * 4. Fournir des recommandations croisées
 */
export class ExamStrategyCoordinator {
    private schoolTypeStrategy: ISchoolTypeStrategy
    private evaluationStrategy: EvaluationStrategy

    constructor(
        schoolTypeStrategy: ISchoolTypeStrategy,
        evaluationStrategy: EvaluationStrategy
    ) {
        this.schoolTypeStrategy = schoolTypeStrategy
        this.evaluationStrategy = evaluationStrategy
    }

    // ==========================================
    // FACTORY METHODS
    // ==========================================

    /**
     * Créer un coordinateur depuis un ID d'école et un type d'évaluation
     *
     * @param schoolId - ID de l'école MongoDB
     * @param evaluationType - Type d'évaluation
     * @returns Coordinateur configuré
     */
    static async fromSchoolId(
        schoolId: string,
        evaluationType: EvaluationType
    ): Promise<ExamStrategyCoordinator> {
        const schoolTypeContext = await SchoolTypeStrategyContext.fromSchoolId(schoolId)
        const evaluationStrategy = EvaluationStrategyFactory.getStrategy(evaluationType)

        return new ExamStrategyCoordinator(
            schoolTypeContext.getStrategy(),
            evaluationStrategy
        )
    }

    /**
     * Créer un coordinateur depuis des niveaux ciblés et un type d'évaluation
     *
     * **Cas d'usage** : Professeur sans école affiliée (mode classe libre)
     *
     * @param targetLevelIds - IDs des niveaux éducatifs
     * @param evaluationType - Type d'évaluation
     * @returns Coordinateur configuré
     */
    static async fromTargetLevels(
        targetLevelIds: string[],
        evaluationType: EvaluationType
    ): Promise<ExamStrategyCoordinator> {
        const schoolTypeContext = await SchoolTypeStrategyContext.fromTargetLevels(targetLevelIds)
        const evaluationStrategy = EvaluationStrategyFactory.getStrategy(evaluationType)

        return new ExamStrategyCoordinator(
            schoolTypeContext.getStrategy(),
            evaluationStrategy
        )
    }

    /**
     * Créer un coordinateur avec détection automatique
     *
     * @param options - schoolId OU targetLevelIds
     * @param evaluationType - Type d'évaluation
     * @returns Coordinateur configuré
     */
    static async fromContext(
        options: {
            schoolId?: string
            targetLevelIds?: string[]
        },
        evaluationType: EvaluationType
    ): Promise<ExamStrategyCoordinator> {
        const schoolTypeContext = await SchoolTypeStrategyContext.fromContext(options)
        const evaluationStrategy = EvaluationStrategyFactory.getStrategy(evaluationType)

        return new ExamStrategyCoordinator(
            schoolTypeContext.getStrategy(),
            evaluationStrategy
        )
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    /**
     * Valider un examen en combinant les deux dimensions
     *
     * Vérifie :
     * 1. Les contraintes du type d'école (durée, nombre de questions, etc.)
     * 2. La compatibilité du type d'évaluation avec le type d'école
     * 3. La cohérence globale de l'examen
     *
     * @param input - Données de l'examen à valider
     * @returns Résultat de validation avec erreurs et avertissements
     */
    validateExam(input: ExamValidationInput): ValidationResult {
        // 1. Validation de base par le SchoolTypeStrategy
        const baseValidation = this.schoolTypeStrategy.validateExam(input)

        // 2. Vérifications croisées (Type d'école × Type d'évaluation)
        const crossValidation = this.performCrossValidation(input)

        // 3. Combiner les résultats
        return {
            isValid: baseValidation.isValid && crossValidation.isValid,
            errors: [...baseValidation.errors, ...crossValidation.errors],
            warnings: [...baseValidation.warnings, ...crossValidation.warnings]
        }
    }

    /**
     * Validation croisée entre type d'école et type d'évaluation
     */
    private performCrossValidation(input: ExamValidationInput): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []

        const constraints = this.schoolTypeStrategy.getValidationConstraints()

        // Vérifier que le type d'évaluation est autorisé
        const config = this.schoolTypeStrategy.getDefaultConfig()

        if (!config.allowedEvaluationTypes.includes(input.evaluationType)) {
            errors.push(
                `Le type d'évaluation "${input.evaluationType}" n'est pas autorisé pour ${this.schoolTypeStrategy.levelName}.`
            )
        }

        // Vérifications spécifiques selon le type d'évaluation
        switch (input.evaluationType) {
            case EvaluationType.ADAPTIVE:
                if (!constraints.allowAdaptiveExams) {
                    errors.push(
                        `Les examens adaptatifs ne sont pas disponibles pour ${this.schoolTypeStrategy.levelName}.`
                    )
                }
                break

            case EvaluationType.EXAM_SIMULATION:
                if (!constraints.allowExamSimulation) {
                    errors.push(
                        `Les simulations d'examen ne sont pas disponibles pour ${this.schoolTypeStrategy.levelName}.`
                    )
                }
                break

            case EvaluationType.OPEN_QUESTION:
                if (input.questionCount && input.questionCount > 15) {
                    warnings.push(
                        `${input.questionCount} questions ouvertes peuvent être difficiles à corriger pour ${this.schoolTypeStrategy.levelName}.`
                    )
                }
                break
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Vérifier si une configuration est optimale
     *
     * Compare la configuration proposée avec les recommandations
     *
     * @param input - Configuration proposée
     * @returns Score d'optimalité (0-100) et suggestions d'amélioration
     */
    checkOptimality(input: ExamValidationInput): {
        score: number
        suggestions: string[]
    } {
        const suggestions: string[] = []
        let score = 100

        const recommended = this.schoolTypeStrategy.getConfigSuggestions(input.evaluationType)

        // Vérifier la durée
        const durationDiff = Math.abs(input.duration - recommended.duration)
        if (durationDiff > 30) {
            score -= 20
            suggestions.push(
                `Durée recommandée : ${recommended.duration} minutes (vous avez : ${input.duration} minutes).`
            )
        }

        // Vérifier le nombre de questions
        const questionDiff = Math.abs(input.questionCount - recommended.questionCount)
        if (questionDiff > 10) {
            score -= 15
            suggestions.push(
                `Nombre de questions recommandé : ${recommended.questionCount} (vous avez : ${input.questionCount}).`
            )
        }

        // Vérifier la note de passage
        const scoreDiff = Math.abs(input.passingScore - recommended.passingScore)
        if (scoreDiff > 10) {
            score -= 10
            suggestions.push(
                `Note de passage recommandée : ${recommended.passingScore}% (vous avez : ${input.passingScore}%).`
            )
        }

        return {
            score: Math.max(0, score),
            suggestions
        }
    }

    // ==========================================
    // ÉVALUATION
    // ==========================================

    /**
     * Évaluer les réponses d'un étudiant
     *
     * Délègue à l'EvaluationStrategy appropriée
     *
     * @param exam - Examen
     * @param responses - Réponses de l'étudiant
     * @param questions - Questions de l'examen
     * @returns Résultat de l'évaluation
     */
    async evaluateResponses(
        exam: IExam,
        responses: any[],
        questions: any[]
    ): Promise<EvaluationResult> {
        // Utiliser l'EvaluationStrategy pour calculer le score
        return this.evaluationStrategy.evaluate(exam, responses, questions)
    }

    /**
     * Évaluer et enrichir avec les métadonnées du type d'école
     *
     * @param exam - Examen
     * @param responses - Réponses de l'étudiant
     * @param questions - Questions de l'examen
     * @returns Résultat enrichi avec terminologie adaptée
     */
    async evaluateWithContext(
        exam: IExam,
        responses: any[],
        questions: any[]
    ): Promise<EvaluationResult & {
        terminology: ReturnType<ISchoolTypeStrategy['getTerminology']>
        gradeLabel: string
    }> {
        // Évaluation de base
        const result = await this.evaluateResponses(exam, responses, questions)

        // Enrichir avec la terminologie
        const terminology = this.schoolTypeStrategy.getTerminology()

        // Formater la note selon l'échelle du niveau
        const gradeLabel = this.formatGrade(result.percentage, terminology.gradingScale)

        return {
            ...result,
            terminology,
            gradeLabel
        }
    }

    /**
     * Formater une note selon l'échelle du niveau
     */
    private formatGrade(percentage: number, gradingScale: string): string {
        if (gradingScale === 'sur 10') {
            return `${(percentage / 10).toFixed(1)}/10`
        }

        if (gradingScale === 'sur 20') {
            return `${(percentage / 5).toFixed(1)}/20`
        }

        if (gradingScale === 'sur 20 ou sur 100') {
            // Par défaut, utiliser /20 pour le supérieur
            return `${(percentage / 5).toFixed(1)}/20 (${percentage.toFixed(0)}%)`
        }

        return `${percentage.toFixed(0)}%`
    }

    // ==========================================
    // RECOMMANDATIONS
    // ==========================================

    /**
     * Obtenir des recommandations complètes pour créer un examen
     *
     * @param evaluationType - Type d'évaluation souhaité
     * @returns Recommandations détaillées
     */
    getRecommendations(evaluationType: EvaluationType): {
        config: ReturnType<ISchoolTypeStrategy['getConfigSuggestions']>
        constraints: ReturnType<ISchoolTypeStrategy['getValidationConstraints']>
        terminology: ReturnType<ISchoolTypeStrategy['getTerminology']>
        features: ReturnType<ISchoolTypeStrategy['getFeatureAvailability']>
        rationale: string
    } {
        const config = this.schoolTypeStrategy.getConfigSuggestions(evaluationType)
        const constraints = this.schoolTypeStrategy.getValidationConstraints()
        const terminology = this.schoolTypeStrategy.getTerminology()
        const features = this.schoolTypeStrategy.getFeatureAvailability()

        const rationale = `
Configuration recommandée pour un ${terminology.examLabel.toLowerCase()} de type ${evaluationType}
destiné à des ${terminology.studentLabel.toLowerCase()}s de ${this.schoolTypeStrategy.levelName}.

${config.rationale}

Fonctionnalités disponibles :
${features.plagiarismDetection ? '✅' : '❌'} Détection de plagiat
${features.certification ? '✅' : '❌'} Certification
${features.proctoredSessions ? '✅' : '❌'} Sessions surveillées
${features.advancedStats ? '✅' : '❌'} Statistiques avancées
        `.trim()

        return {
            config,
            constraints,
            terminology,
            features,
            rationale
        }
    }

    /**
     * Calculer la difficulté recommandée en tenant compte des deux dimensions
     *
     * @param targetLevelIds - Niveaux ciblés
     * @param conceptCount - Nombre de concepts
     * @param evaluationType - Type d'évaluation
     * @returns Score de difficulté (0-100)
     */
    calculateRecommendedDifficulty(
        targetLevelIds: string[],
        conceptCount: number,
        evaluationType: EvaluationType
    ): number {
        // Difficulté de base selon le type d'école
        let difficulty = this.schoolTypeStrategy.calculateRecommendedDifficulty(
            targetLevelIds,
            conceptCount
        )

        // Ajustement selon le type d'évaluation
        switch (evaluationType) {
            case EvaluationType.QCM:
                // QCM légèrement plus facile
                difficulty -= 5
                break

            case EvaluationType.OPEN_QUESTION:
                // Questions ouvertes plus difficiles
                difficulty += 10
                break

            case EvaluationType.ADAPTIVE:
                // Adaptatif s'ajuste automatiquement, pas de bonus
                break

            case EvaluationType.EXAM_SIMULATION:
                // Simulation plus exigeante
                difficulty += 15
                break
        }

        return Math.max(0, Math.min(100, difficulty))
    }

    // ==========================================
    // GETTERS
    // ==========================================

    /**
     * Obtenir la stratégie de type d'école
     */
    getSchoolTypeStrategy(): ISchoolTypeStrategy {
        return this.schoolTypeStrategy
    }

    /**
     * Obtenir la stratégie d'évaluation
     */
    getEvaluationStrategy(): EvaluationStrategy {
        return this.evaluationStrategy
    }

    /**
     * Obtenir le type d'école géré
     */
    getSchoolType() {
        return this.schoolTypeStrategy.schoolType
    }

    /**
     * Obtenir le nom du niveau
     */
    getLevelName() {
        return this.schoolTypeStrategy.levelName
    }
}

/**
 * Export du type pour faciliter l'usage
 */
export type ExamStrategyCoordinatorType = ExamStrategyCoordinator
