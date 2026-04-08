import { SchoolType } from '@/models/School'
import EducationLevel from '@/models/EducationLevel'
import { Cycle } from '@/models/enums'

/**
 * Détecteur de type d'école
 *
 * Permet de déduire automatiquement le schoolType dans différents contextes :
 * - Depuis des IDs de niveaux éducatifs (targetLevels)
 * - Depuis des cycles (PRIMAIRE, COLLEGE, etc.)
 * - Depuis un mix de niveaux (choisir le plus pertinent)
 *
 * Cas d'usage :
 * - Professeur non affilié à une école
 * - Mode classe libre
 * - Création d'examen avant sélection d'école
 */

/**
 * Déduire le schoolType depuis un cycle
 */
export function getSchoolTypeFromCycle(cycle: Cycle): SchoolType {
    switch (cycle) {
        case Cycle.PRESCOLAIRE:
        case Cycle.PRIMAIRE:
            return SchoolType.PRIMARY

        case Cycle.SECONDAIRE_PREMIER_CYCLE:
        case Cycle.SECONDAIRE_SECOND_CYCLE:
            return SchoolType.SECONDARY

        case Cycle.SUPERIEUR:
            return SchoolType.HIGHER_ED

        default:
            return SchoolType.SECONDARY // Par défaut
    }
}

/**
 * Déduire le schoolType depuis des IDs de niveaux éducatifs
 *
 * Logique :
 * 1. Si tous les niveaux sont du même type → retourner ce type
 * 2. Si mix de niveaux → prioriser : HIGHER_ED > SECONDARY > PRIMARY
 *
 * @param educationLevelIds - IDs des niveaux éducatifs MongoDB
 * @returns SchoolType déduit
 */
export async function deduceSchoolTypeFromLevels(
    educationLevelIds: string[]
): Promise<SchoolType> {
    if (!educationLevelIds || educationLevelIds.length === 0) {
        // Par défaut : secondaire (le plus polyvalent)
        return SchoolType.SECONDARY
    }

    // Récupérer les niveaux depuis la BD
    const levels = await EducationLevel.find({
        _id: { $in: educationLevelIds }
    }).select('cycle schoolType')

    if (levels.length === 0) {
        return SchoolType.SECONDARY
    }

    // Stratégie 1 : Si des schoolTypes existent déjà, les utiliser
    const schoolTypes = levels
        .filter(level => level.schoolType)
        .map(level => level.schoolType)

    if (schoolTypes.length > 0) {
        const uniqueTypes = [...new Set(schoolTypes)]

        // Si tous les niveaux ont le même type → utiliser ce type
        if (uniqueTypes.length === 1) {
            return uniqueTypes[0]
        }

        // Sinon, prioriser : HIGHER_ED > SECONDARY > PRIMARY
        if (uniqueTypes.includes(SchoolType.HIGHER_ED)) {
            return SchoolType.HIGHER_ED
        }
        if (uniqueTypes.includes(SchoolType.SECONDARY)) {
            return SchoolType.SECONDARY
        }
        return SchoolType.PRIMARY
    }

    // Stratégie 2 : Déduire depuis les cycles (si schoolType n'existe pas)
    const cycles = levels.map(level => level.cycle)
    const uniqueCycles = [...new Set(cycles)]

    // Si tous les niveaux sont du même cycle
    if (uniqueCycles.length === 1) {
        return getSchoolTypeFromCycle(uniqueCycles[0])
    }

    // Mix de cycles → déduire le type dominant
    const cycleSchoolTypes = cycles.map(cycle => getSchoolTypeFromCycle(cycle))
    const uniqueSchoolTypes = [...new Set(cycleSchoolTypes)]

    // Priorisation : HIGHER_ED > SECONDARY > PRIMARY
    if (uniqueSchoolTypes.includes(SchoolType.HIGHER_ED)) {
        return SchoolType.HIGHER_ED
    }
    if (uniqueSchoolTypes.includes(SchoolType.SECONDARY)) {
        return SchoolType.SECONDARY
    }
    return SchoolType.PRIMARY
}

/**
 * Déduire le schoolType depuis des cycles (sans requête BD)
 *
 * Utile pour les cas où on a directement les cycles disponibles
 *
 * @param cycles - Liste de cycles
 * @returns SchoolType déduit
 */
export function deduceSchoolTypeFromCycles(cycles: Cycle[]): SchoolType {
    if (!cycles || cycles.length === 0) {
        return SchoolType.SECONDARY
    }

    const uniqueCycles = [...new Set(cycles)]

    // Si tous les cycles sont du même type
    if (uniqueCycles.length === 1) {
        return getSchoolTypeFromCycle(uniqueCycles[0])
    }

    // Mix de cycles → déduire le type dominant
    const schoolTypes = cycles.map(cycle => getSchoolTypeFromCycle(cycle))
    const uniqueSchoolTypes = [...new Set(schoolTypes)]

    // Priorisation : HIGHER_ED > SECONDARY > PRIMARY
    if (uniqueSchoolTypes.includes(SchoolType.HIGHER_ED)) {
        return SchoolType.HIGHER_ED
    }
    if (uniqueSchoolTypes.includes(SchoolType.SECONDARY)) {
        return SchoolType.SECONDARY
    }
    return SchoolType.PRIMARY
}

/**
 * Vérifier si un schoolType est compatible avec une liste de niveaux
 *
 * @param schoolType - Type d'école à vérifier
 * @param educationLevelIds - IDs des niveaux éducatifs
 * @returns true si compatible, false sinon
 */
export async function isSchoolTypeCompatibleWithLevels(
    schoolType: SchoolType,
    educationLevelIds: string[]
): Promise<boolean> {
    if (!educationLevelIds || educationLevelIds.length === 0) {
        return true // Aucune contrainte
    }

    const levels = await EducationLevel.find({
        _id: { $in: educationLevelIds }
    }).select('cycle schoolType')

    // Vérifier que tous les niveaux sont compatibles avec le schoolType
    return levels.every(level => {
        // Si le niveau a déjà un schoolType, vérifier la compatibilité
        if (level.schoolType) {
            return level.schoolType === schoolType
        }

        // Sinon, déduire depuis le cycle
        const levelSchoolType = getSchoolTypeFromCycle(level.cycle)
        return levelSchoolType === schoolType
    })
}

/**
 * Obtenir une suggestion de schoolType avec un score de confiance
 *
 * Utile pour l'UI : afficher une suggestion au professeur
 *
 * @param educationLevelIds - IDs des niveaux éducatifs sélectionnés
 * @returns { schoolType, confidence, explanation }
 */
export async function suggestSchoolType(educationLevelIds: string[]): Promise<{
    schoolType: SchoolType
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    explanation: string
}> {
    if (!educationLevelIds || educationLevelIds.length === 0) {
        return {
            schoolType: SchoolType.SECONDARY,
            confidence: 'LOW',
            explanation: 'Aucun niveau sélectionné. Type secondaire par défaut.'
        }
    }

    const levels = await EducationLevel.find({
        _id: { $in: educationLevelIds }
    }).select('cycle schoolType name')

    if (levels.length === 0) {
        return {
            schoolType: SchoolType.SECONDARY,
            confidence: 'LOW',
            explanation: 'Niveaux introuvables. Type secondaire par défaut.'
        }
    }

    // Déduire le schoolType
    const schoolTypes = levels.map(level =>
        level.schoolType || getSchoolTypeFromCycle(level.cycle)
    )

    const uniqueTypes = [...new Set(schoolTypes)]

    // Cas 1 : Tous les niveaux sont du même type → HAUTE confiance
    if (uniqueTypes.length === 1) {
        const levelNames = levels.map(l => l.name).join(', ')
        return {
            schoolType: uniqueTypes[0],
            confidence: 'HIGH',
            explanation: `Tous les niveaux sélectionnés (${levelNames}) correspondent au type ${uniqueTypes[0]}.`
        }
    }

    // Cas 2 : Mix de types → MOYENNE confiance
    const dominantType = uniqueTypes.includes(SchoolType.HIGHER_ED)
        ? SchoolType.HIGHER_ED
        : uniqueTypes.includes(SchoolType.SECONDARY)
        ? SchoolType.SECONDARY
        : SchoolType.PRIMARY

    const dominantLevels = levels.filter(level => {
        const type = level.schoolType || getSchoolTypeFromCycle(level.cycle)
        return type === dominantType
    })

    return {
        schoolType: dominantType,
        confidence: 'MEDIUM',
        explanation: `Mix de niveaux détecté. Type ${dominantType} suggéré car ${dominantLevels.length}/${levels.length} niveaux correspondent.`
    }
}

/**
 * Obtenir le label lisible d'un schoolType
 */
export function getSchoolTypeLabel(schoolType: SchoolType): string {
    switch (schoolType) {
        case SchoolType.PRIMARY:
            return 'École Primaire'
        case SchoolType.SECONDARY:
            return 'École Secondaire'
        case SchoolType.HIGHER_ED:
            return 'Enseignement Supérieur'
        case SchoolType.TRAINING_CENTER:
            return 'Centre de Formation'
        case SchoolType.OTHER:
            return 'Autre'
        default:
            return 'Non spécifié'
    }
}
