import { SchoolType } from '@/models/School'
import School from '@/models/School'
import { ISchoolTypeStrategy } from './ISchoolTypeStrategy'
import { primaryExamStrategy } from './PrimaryExamStrategy'
import { secondaryExamStrategy } from './SecondaryExamStrategy'
import { higherEdExamStrategy } from './HigherEdExamStrategy'
import { deduceSchoolTypeFromLevels, suggestSchoolType } from './SchoolTypeDetector'

/**
 * Contexte de stratégie pour les types d'école
 *
 * Pattern : Strategy + Context
 *
 * Sélectionne automatiquement la bonne stratégie (Primary, Secondary, Higher Ed)
 * selon le type d'école, et délègue les opérations à cette stratégie.
 *
 * Usage :
 * ```typescript
 * // Depuis un ID d'école
 * const context = await SchoolTypeStrategyContext.fromSchoolId('school_id')
 * const config = context.getDefaultConfig()
 *
 * // Depuis un type d'école
 * const context = SchoolTypeStrategyContext.fromSchoolType(SchoolType.PRIMARY)
 * const validation = context.validateExam({ ... })
 * ```
 */
export class SchoolTypeStrategyContext {
    private strategy: ISchoolTypeStrategy

    /**
     * Constructeur privé
     * Utilisez les méthodes statiques `fromSchoolId` ou `fromSchoolType` pour créer une instance
     */
    private constructor(strategy: ISchoolTypeStrategy) {
        this.strategy = strategy
    }

    // ==========================================
    // FACTORY METHODS
    // ==========================================

    /**
     * Créer un contexte depuis un ID d'école
     *
     * @param schoolId - ID de l'école MongoDB
     * @returns Contexte avec la stratégie appropriée
     * @throws Error si l'école n'existe pas
     */
    static async fromSchoolId(schoolId: string): Promise<SchoolTypeStrategyContext> {
        const school = await School.findById(schoolId).select('type')

        if (!school) {
            throw new Error(`École avec l'ID ${schoolId} introuvable.`)
        }

        return SchoolTypeStrategyContext.fromSchoolType(school.type)
    }

    /**
     * Créer un contexte depuis un type d'école
     *
     * @param schoolType - Type d'école (PRIMARY, SECONDARY, HIGHER_ED)
     * @returns Contexte avec la stratégie appropriée
     * @throws Error si le type d'école n'est pas reconnu
     */
    static fromSchoolType(schoolType: SchoolType): SchoolTypeStrategyContext {
        const strategy = SchoolTypeStrategyContext.getStrategy(schoolType)
        return new SchoolTypeStrategyContext(strategy)
    }

    /**
     * Créer un contexte depuis des niveaux éducatifs ciblés
     *
     * **Cas d'usage** : Professeur non affilié à une école, mode classe libre
     *
     * Le schoolType est déduit automatiquement depuis les niveaux sélectionnés :
     * - CP, CE1 → PRIMARY
     * - 6ème, 5ème → SECONDARY
     * - Licence 1 → HIGHER_ED
     *
     * @param targetLevelIds - IDs des niveaux éducatifs MongoDB
     * @returns Contexte avec la stratégie appropriée
     */
    static async fromTargetLevels(targetLevelIds: string[]): Promise<SchoolTypeStrategyContext> {
        const schoolType = await deduceSchoolTypeFromLevels(targetLevelIds)
        return SchoolTypeStrategyContext.fromSchoolType(schoolType)
    }

    /**
     * Créer un contexte automatiquement selon le contexte disponible
     *
     * **Ordre de priorité** :
     * 1. Si schoolId fourni → utiliser le type de l'école
     * 2. Sinon, si targetLevelIds fournis → déduire depuis les niveaux
     * 3. Sinon → utiliser SECONDARY par défaut
     *
     * @param options - schoolId OU targetLevelIds
     * @returns Contexte avec la stratégie appropriée
     */
    static async fromContext(options: {
        schoolId?: string
        targetLevelIds?: string[]
    }): Promise<SchoolTypeStrategyContext> {
        // Priorité 1 : École affiliée
        if (options.schoolId) {
            return SchoolTypeStrategyContext.fromSchoolId(options.schoolId)
        }

        // Priorité 2 : Déduction depuis les niveaux
        if (options.targetLevelIds && options.targetLevelIds.length > 0) {
            return SchoolTypeStrategyContext.fromTargetLevels(options.targetLevelIds)
        }

        // Priorité 3 : Par défaut (secondaire)
        return SchoolTypeStrategyContext.fromSchoolType(SchoolType.SECONDARY)
    }

    /**
     * Obtenir la stratégie correspondant à un type d'école
     *
     * @param schoolType - Type d'école
     * @returns Stratégie appropriée
     * @throws Error si le type d'école n'est pas géré
     */
    private static getStrategy(schoolType: SchoolType): ISchoolTypeStrategy {
        switch (schoolType) {
            case SchoolType.PRIMARY:
                return primaryExamStrategy

            case SchoolType.SECONDARY:
                return secondaryExamStrategy

            case SchoolType.HIGHER_ED:
                return higherEdExamStrategy

            case SchoolType.TRAINING_CENTER:
                // Les centres de formation utilisent la stratégie secondaire par défaut
                // (peut être affinée ultérieurement avec une stratégie dédiée)
                return secondaryExamStrategy

            case SchoolType.OTHER:
                // Type "Autre" utilise la stratégie secondaire par défaut
                return secondaryExamStrategy

            default:
                throw new Error(`Type d'école non reconnu : ${schoolType}`)
        }
    }

    // ==========================================
    // MÉTHODES DÉLÉGUÉES À LA STRATÉGIE
    // ==========================================

    /**
     * Obtenir le type d'école géré par la stratégie actuelle
     */
    getSchoolType(): SchoolType {
        return this.strategy.schoolType
    }

    /**
     * Obtenir le nom descriptif du niveau
     */
    getLevelName(): string {
        return this.strategy.levelName
    }

    /**
     * Obtenir la configuration par défaut des examens
     */
    getDefaultConfig() {
        return this.strategy.getDefaultConfig()
    }

    /**
     * Obtenir les contraintes de validation
     */
    getValidationConstraints() {
        return this.strategy.getValidationConstraints()
    }

    /**
     * Obtenir la terminologie adaptée au niveau
     */
    getTerminology() {
        return this.strategy.getTerminology()
    }

    /**
     * Obtenir les fonctionnalités disponibles
     */
    getFeatureAvailability() {
        return this.strategy.getFeatureAvailability()
    }

    /**
     * Valider un examen selon les contraintes du niveau
     */
    validateExam(input: Parameters<ISchoolTypeStrategy['validateExam']>[0]) {
        return this.strategy.validateExam(input)
    }

    /**
     * Calculer un score de difficulté recommandé
     */
    calculateRecommendedDifficulty(targetLevelIds: string[], conceptCount: number) {
        return this.strategy.calculateRecommendedDifficulty(targetLevelIds, conceptCount)
    }

    /**
     * Obtenir des suggestions de configuration
     */
    getConfigSuggestions(evaluationType: Parameters<ISchoolTypeStrategy['getConfigSuggestions']>[0]) {
        return this.strategy.getConfigSuggestions(evaluationType)
    }

    /**
     * Vérifier la compatibilité d'un niveau éducatif
     */
    async isEducationLevelCompatible(educationLevelId: string) {
        return this.strategy.isEducationLevelCompatible(educationLevelId)
    }

    /**
     * Obtenir les niveaux éducatifs recommandés
     */
    async getRecommendedEducationLevels() {
        return this.strategy.getRecommendedEducationLevels()
    }

    /**
     * Obtenir la stratégie interne (pour usage avancé)
     */
    getStrategy(): ISchoolTypeStrategy {
        return this.strategy
    }
}

// ==========================================
// FONCTIONS UTILITAIRES D'EXPORT
// ==========================================

/**
 * Créer un contexte depuis un ID d'école (alias pour faciliter l'import)
 */
export const createContextFromSchoolId = SchoolTypeStrategyContext.fromSchoolId

/**
 * Créer un contexte depuis un type d'école (alias pour faciliter l'import)
 */
export const createContextFromSchoolType = SchoolTypeStrategyContext.fromSchoolType

/**
 * Créer un contexte depuis des niveaux ciblés (alias pour faciliter l'import)
 */
export const createContextFromTargetLevels = SchoolTypeStrategyContext.fromTargetLevels

/**
 * Créer un contexte automatiquement selon le contexte disponible (alias pour faciliter l'import)
 */
export const createContextFromAny = SchoolTypeStrategyContext.fromContext

/**
 * Export des stratégies singleton pour usage direct
 */
export {
    primaryExamStrategy,
    secondaryExamStrategy,
    higherEdExamStrategy
}

/**
 * Export du type pour faciliter les imports
 */
export type { ISchoolTypeStrategy }
