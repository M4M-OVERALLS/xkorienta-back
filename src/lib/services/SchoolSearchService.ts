/**
 * SchoolSearchService
 *
 * Service de recherche fuzzy pour les écoles validées.
 * Implémente :
 *  - Normalisation des noms (accents, casse, espaces)
 *  - Distance de Levenshtein
 *  - Score de similarité combiné (Levenshtein + token overlap)
 *  - Suggestions triées par pertinence
 */

import School from '@/models/School'
import connectDB from '@/lib/mongodb'

export interface SchoolSearchResult {
    id: string
    name: string
    city: string
    type: string
    matchScore: number // 0-100
}

export interface SchoolSuggestion {
    name: string
    score: number
}

export class SchoolSearchService {

    // ─────────────────────────────────────────────────────────────────────────
    // Normalisation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Normalise un nom d'école :
     * - Lowercase
     * - Supprime les espaces multiples
     * - Supprime les caractères dangereux (HTML, &, etc.) sauf apostrophe et tirets
     */
    static normalizeSchoolName(input: string): string {
        if (!input) return ''

        return input
            .toLowerCase()
            .trim()
            // Supprimer les tags HTML
            .replace(/<[^>]*>/g, '')
            // Supprimer le & HTML entity
            .replace(/&amp;/g, 'et')
            .replace(/&/g, 'et')
            // Supprimer les caractères non-alphabétiques sauf apostrophes, tirets, espaces, accents
            .replace(/[^\wÀ-ÿ\s'\-]/g, ' ')
            // Normaliser les espaces multiples
            .replace(/\s+/g, ' ')
            .trim()
    }

    /**
     * Supprime les accents d'une chaîne pour comparaison tolérante
     */
    static removeAccents(input: string): string {
        return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Distance de Levenshtein
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule la distance de Levenshtein entre deux chaînes.
     * Sensible à la casse (normaliser avant si nécessaire).
     */
    static calculateLevenshteinDistance(str1: string, str2: string): number {
        const m = str1.length
        const n = str2.length

        // Matrice DP de taille (m+1) x (n+1)
        const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
            Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
        )

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1]
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
                }
            }
        }

        return dp[m][n]
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Score de similarité (fuzzy match)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule un score de similarité entre 0 et 100 entre query et target.
     * Combine :
     *  - Score Levenshtein basé sur la longueur max
     *  - Score de recouvrement de tokens (mots en commun)
     *  - Bonus pour inclusion d'une chaîne dans l'autre
     */
    static fuzzyMatch(query: string, target: string): number {
        // Cas limites
        if (query === '' && target === '') return 100
        if (query === '' || target === '') return 0

        // Normalisation pour comparaison
        const normQuery = SchoolSearchService.removeAccents(
            SchoolSearchService.normalizeSchoolName(query)
        )
        const normTarget = SchoolSearchService.removeAccents(
            SchoolSearchService.normalizeSchoolName(target)
        )

        if (normQuery === normTarget) return 100

        // 1. Score Levenshtein (sur les chaînes sans accents)
        const dist = SchoolSearchService.calculateLevenshteinDistance(normQuery, normTarget)
        const maxLen = Math.max(normQuery.length, normTarget.length)
        const levenshteinScore = maxLen === 0 ? 100 : Math.round((1 - dist / maxLen) * 100)

        // 2. Score basé sur les tokens triés (pour gérer le réordonnancement)
        const sortString = (s: string) => s.split(/\s+/).filter(t => t.length > 2).sort().join(' ')
        const sortedQuery = sortString(normQuery)
        const sortedTarget = sortString(normTarget)
        
        let sortedScore = 0
        if (sortedQuery && sortedTarget) {
            const sortedDist = SchoolSearchService.calculateLevenshteinDistance(sortedQuery, sortedTarget)
            const maxSortedLen = Math.max(sortedQuery.length, sortedTarget.length)
            sortedScore = maxSortedLen === 0 ? 0 : Math.round((1 - sortedDist / maxSortedLen) * 100)
        }

        // 3. Score de recouvrement de tokens
        const qTokens = normQuery.split(/\s+/).filter(t => t.length > 2)
        const tTokens = normTarget.split(/\s+/).filter(t => t.length > 2)
        const queryTokens = new Set(qTokens)
        const targetTokens = new Set(tTokens)

        if (queryTokens.size === 0 || targetTokens.size === 0) {
            return Math.max(levenshteinScore, sortedScore)
        }

        let matchedTokens = 0
        queryTokens.forEach(token => {
            if (targetTokens.has(token)) {
                matchedTokens++
            } else {
                // Correspondance partielle avec Levenshtein sur les tokens
                let bestTokenMatch = 0
                targetTokens.forEach(targetToken => {
                    const tokenDist = SchoolSearchService.calculateLevenshteinDistance(token, targetToken)
                    const maxTlen = Math.max(token.length, targetToken.length)
                    const s = 1 - tokenDist / maxTlen
                    if (s > 0.7) bestTokenMatch = Math.max(bestTokenMatch, s)
                })
                matchedTokens += bestTokenMatch
            }
        })

        const tokenScore = Math.round((matchedTokens / queryTokens.size) * 100)

        // 4. Bonus d'inclusion
        let inclusionBonus = 0
        if (normTarget.includes(normQuery) || normQuery.includes(normTarget)) {
            inclusionBonus = 15
        }

        // Score combiné : Mixage plus équilibré
        // On donne beaucoup de poids au meilleur entre Levenshtein original, Version triée et Token match
        const baseScore = Math.max(levenshteinScore, sortedScore, tokenScore)
        
        // On affine le score final
        const combinedScore = Math.min(100, Math.round(baseScore * 0.85 + inclusionBonus))


        return combinedScore
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suggestions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Génère des suggestions de corrections pour une liste d'écoles.
     */
    static suggestCorrections(
        query: string,
        availableSchools: string[],
        threshold = 30,
        limit = 5
    ): SchoolSuggestion[] {
        const scored = availableSchools.map(name => ({
            name,
            score: SchoolSearchService.fuzzyMatch(query, name)
        }))

        return scored
            .filter(s => s.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recherche en base de données
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Recherche des écoles validées en base avec fuzzy matching.
     * Utilise d'abord la recherche full-text MongoDB puis un re-ranking fuzzy.
     */
    static async searchSchools(params: {
        q: string
        city?: string
        type?: string
        limit?: number
    }): Promise<{ schools: SchoolSearchResult[]; hasExactMatch: boolean }> {
        await connectDB()

        const { q, city, type, limit = 10 } = params

        if (!q || q.trim().length < 2) {
            return { schools: [], hasExactMatch: false }
        }

        const normalizedQuery = SchoolSearchService.normalizeSchoolName(q)

        // Construire le filtre MongoDB
        const filter: any = {
            $or: [
                { $text: { $search: q } },
                { name: { $regex: normalizedQuery.split(' ').join('|'), $options: 'i' } }
            ]
        }

        if (city) filter.city = { $regex: city, $options: 'i' }
        if (type) filter.type = type

        // Récupérer plus de résultats pour le re-ranking
        const candidates = await School.find(filter)
            .select('name city type')
            .limit(limit * 3)
            .lean()

        // Re-ranking fuzzy côté applicatif
        const scored: SchoolSearchResult[] = candidates
            .map((school: any) => ({
                id: school._id.toString(),
                name: school.name,
                city: school.city || '',
                type: school.type || '',
                matchScore: SchoolSearchService.fuzzyMatch(q, school.name)
            }))
            .filter(s => s.matchScore > 20)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, limit)

        const hasExactMatch = scored.some(s => s.matchScore >= 95)

        return { schools: scored, hasExactMatch }
    }
}
