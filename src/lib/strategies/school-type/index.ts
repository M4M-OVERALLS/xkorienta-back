/**
 * Barrel export pour les stratégies de type d'école
 *
 * Facilite l'import des stratégies depuis d'autres modules :
 *
 * ```typescript
 * import { SchoolTypeStrategyContext, primaryExamStrategy } from '@/lib/strategies/school-type'
 * ```
 */

// Interface principale
export type {
    ISchoolTypeStrategy,
    ExamDefaultConfig,
    ValidationConstraints,
    LevelTerminology,
    FeatureAvailability,
    ValidationResult,
    ExamValidationInput
} from './ISchoolTypeStrategy'

// Stratégies concrètes
export { PrimaryExamStrategy, primaryExamStrategy } from './PrimaryExamStrategy'
export { SecondaryExamStrategy, secondaryExamStrategy } from './SecondaryExamStrategy'
export { HigherEdExamStrategy, higherEdExamStrategy } from './HigherEdExamStrategy'

// Contexte de sélection
export {
    SchoolTypeStrategyContext,
    createContextFromSchoolId,
    createContextFromSchoolType,
    createContextFromTargetLevels,
    createContextFromAny
} from './SchoolTypeStrategyContext'

// Détecteur et utilitaires
export {
    deduceSchoolTypeFromLevels,
    deduceSchoolTypeFromCycles,
    getSchoolTypeFromCycle,
    isSchoolTypeCompatibleWithLevels,
    suggestSchoolType,
    getSchoolTypeLabel
} from './SchoolTypeDetector'

// Helpers pour la validation avec cycles
export {
    isEducationLevelCompatibleWithSchool,
    areEducationLevelsCompatibleWithSchool,
    getCompatibleEducationLevelsForSchool,
    getSuggestedCyclesForSchoolType
} from './helpers'
