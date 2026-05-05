/**
 * Helpers pour les stratégies de type d'école
 *
 * Ces fonctions facilitent la validation de compatibilité entre écoles,
 * niveaux éducatifs et examens en tenant compte des cycles.
 */

import { SchoolType } from '@/models/School'
import { Cycle } from '@/models/enums'
import School from '@/models/School'
import EducationLevel from '@/models/EducationLevel'
import { createContextFromSchoolType } from './SchoolTypeStrategyContext'

/**
 * Vérifier si un niveau éducatif est compatible avec une école
 *
 * Cette fonction prend en compte :
 * - Le type d'école (PRIMARY, SECONDARY, HIGHER_ED)
 * - Les cycles effectivement enseignés dans l'école
 *
 * @param schoolId - ID de l'école
 * @param educationLevelId - ID du niveau éducatif
 * @returns true si compatible, false sinon
 *
 * @example
 * ```typescript
 * // Vérifier si un niveau 6ème est compatible avec un lycée
 * const isCompatible = await isEducationLevelCompatibleWithSchool(
 *   '507f1f77bcf86cd799439011', // ID du lycée
 *   '507f191e810c19729de860ea'  // ID de la 6ème
 * )
 * // Résultat : false (un lycée n'enseigne que 2nde → Tle)
 * ```
 */
export async function isEducationLevelCompatibleWithSchool(
    schoolId: string,
    educationLevelId: string
): Promise<boolean> {
    try {
        // Récupérer l'école
        const school = await School.findById(schoolId).select('type cycles')
        if (!school) {
            console.error(`École non trouvée : ${schoolId}`)
            return false
        }

        // Obtenir la stratégie adaptée au type d'école
        const strategy = createContextFromSchoolType(school.type).getStrategy()

        // Vérifier la compatibilité en tenant compte des cycles de l'école
        return await strategy.isEducationLevelCompatible(
            educationLevelId,
            school.cycles
        )
    } catch (error) {
        console.error('Erreur lors de la vérification de compatibilité:', error)
        return false
    }
}

/**
 * Vérifier si plusieurs niveaux éducatifs sont compatibles avec une école
 *
 * @param schoolId - ID de l'école
 * @param educationLevelIds - IDs des niveaux éducatifs
 * @returns { compatible: true/false, incompatibleLevels: [...] }
 *
 * @example
 * ```typescript
 * const result = await areEducationLevelsCompatibleWithSchool(
 *   schoolId,
 *   ['6ème', '5ème', '2nde']
 * )
 * // Pour un collège uniquement :
 * // { compatible: false, incompatibleLevels: ['2nde'] }
 * ```
 */
export async function areEducationLevelsCompatibleWithSchool(
    schoolId: string,
    educationLevelIds: string[]
): Promise<{
    compatible: boolean
    incompatibleLevels: Array<{ id: string; name: string; cycle: Cycle }>
}> {
    const incompatibleLevels: Array<{ id: string; name: string; cycle: Cycle }> = []

    for (const levelId of educationLevelIds) {
        const isCompatible = await isEducationLevelCompatibleWithSchool(schoolId, levelId)

        if (!isCompatible) {
            // Récupérer les infos du niveau pour le retour
            const level = await EducationLevel.findById(levelId).select('name cycle')
            if (level) {
                incompatibleLevels.push({
                    id: levelId,
                    name: level.name,
                    cycle: level.cycle
                })
            }
        }
    }

    return {
        compatible: incompatibleLevels.length === 0,
        incompatibleLevels
    }
}

/**
 * Obtenir les niveaux éducatifs compatibles avec une école
 *
 * Retourne tous les niveaux éducatifs que l'école peut enseigner
 * en fonction de son type et de ses cycles.
 *
 * @param schoolId - ID de l'école
 * @returns Liste des niveaux éducatifs compatibles
 *
 * @example
 * ```typescript
 * // Pour un lycée uniquement (cycles: [LYCEE])
 * const levels = await getCompatibleEducationLevelsForSchool(schoolId)
 * // Résultat : [2nde, 1ère, Terminale]
 * ```
 */
export async function getCompatibleEducationLevelsForSchool(
    schoolId: string
): Promise<Array<{ id: string; name: string; cycle: Cycle }>> {
    try {
        const school = await School.findById(schoolId).select('type cycles')
        if (!school) {
            console.error(`École non trouvée : ${schoolId}`)
            return []
        }

        // Si l'école a des cycles spécifiés, filtrer par cycles
        if (school.cycles && school.cycles.length > 0) {
            const levels = await EducationLevel.find({
                cycle: { $in: school.cycles },
                isActive: true
            }).select('name cycle')

            return levels.map(level => ({
                id: level._id.toString(),
                name: level.name,
                cycle: level.cycle
            }))
        }

        // Sinon, utiliser la stratégie par défaut
        const strategy = createContextFromSchoolType(school.type).getStrategy()
        const recommendedIds = await strategy.getRecommendedEducationLevels()

        const levels = await EducationLevel.find({
            _id: { $in: recommendedIds },
            isActive: true
        }).select('name cycle')

        return levels.map(level => ({
            id: level._id.toString(),
            name: level.name,
            cycle: level.cycle
        }))
    } catch (error) {
        console.error('Erreur lors de la récupération des niveaux compatibles:', error)
        return []
    }
}

/**
 * Suggérer les cycles à configurer pour une école selon son type
 *
 * Utile pour l'interface de création/édition d'école
 *
 * @param schoolType - Type d'école
 * @returns Suggestions de cycles avec explications
 *
 * @example
 * ```typescript
 * const suggestions = getSuggestedCyclesForSchoolType(SchoolType.SECONDARY)
 * // Résultat :
 * // {
 * //   default: [COLLEGE, LYCEE],
 * //   options: [
 * //     { cycles: [COLLEGE, LYCEE], label: "Collège-Lycée (6ème → Terminale)", ... },
 * //     { cycles: [COLLEGE], label: "Collège uniquement (6ème → 3ème)", ... },
 * //     { cycles: [LYCEE], label: "Lycée uniquement (2nde → Terminale)", ... }
 * //   ]
 * // }
 * ```
 */
export function getSuggestedCyclesForSchoolType(schoolType: SchoolType): {
    default: Cycle[]
    options: Array<{
        cycles: Cycle[]
        label: string
        description: string
        isCommon: boolean
    }>
} {
    switch (schoolType) {
        case SchoolType.PRIMARY:
            return {
                default: [Cycle.PRESCOLAIRE, Cycle.PRIMAIRE],
                options: [
                    {
                        cycles: [Cycle.PRESCOLAIRE, Cycle.PRIMAIRE],
                        label: 'École primaire complète',
                        description: 'Maternelle + Primaire (Petite section → CM2)',
                        isCommon: true
                    },
                    {
                        cycles: [Cycle.PRIMAIRE],
                        label: 'Primaire uniquement',
                        description: 'CP → CM2',
                        isCommon: false
                    },
                    {
                        cycles: [Cycle.PRESCOLAIRE],
                        label: 'Maternelle uniquement',
                        description: 'Petite section → Grande section',
                        isCommon: false
                    }
                ]
            }

        case SchoolType.SECONDARY:
            return {
                default: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
                options: [
                    {
                        cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
                        label: 'Collège-Lycée combiné',
                        description: '6ème → Terminale (cas le plus fréquent au Cameroun)',
                        isCommon: true
                    },
                    {
                        cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE],
                        label: 'Collège uniquement',
                        description: '6ème → 3ème',
                        isCommon: false
                    },
                    {
                        cycles: [Cycle.SECONDAIRE_SECOND_CYCLE],
                        label: 'Lycée uniquement',
                        description: '2nde → Terminale',
                        isCommon: false
                    }
                ]
            }

        case SchoolType.HIGHER_ED:
            return {
                default: [Cycle.SUPERIEUR],
                options: [
                    {
                        cycles: [Cycle.SUPERIEUR],
                        label: 'Enseignement supérieur (générique)',
                        description: 'Pour les établissements offrant divers niveaux',
                        isCommon: true
                    },
                    {
                        cycles: [Cycle.LICENCE, Cycle.MASTER],
                        label: 'Licence + Master',
                        description: 'L1 → M2',
                        isCommon: true
                    },
                    {
                        cycles: [Cycle.LICENCE],
                        label: 'Licence uniquement',
                        description: 'L1 → L3',
                        isCommon: false
                    },
                    {
                        cycles: [Cycle.MASTER],
                        label: 'Master uniquement',
                        description: 'M1 → M2',
                        isCommon: false
                    }
                ]
            }

        default:
            return {
                default: [],
                options: []
            }
    }
}
