/**
 * Détection de la phase « génération du rapport » (Sonnet + max_tokens élevé).
 *
 * L'élève peut converser autant qu'il veut (Haiku) ; Sonnet n'est utilisé que lorsque
 * le rapport est explicitement demandé ou que l'IA a annoncé sa rédaction imminente.
 */

export type OrientationChatMessage = { role: 'user' | 'assistant'; content: string }

const USER_REPORT_PHRASES = [
    '/rapport',
    'rapport d\'orientation',
    'rapport d’orientation',
    'mon rapport',
    'génère le rapport',
    'genere le rapport',
    'générer le rapport',
    'donne-moi mon rapport',
    'donne moi mon rapport',
    'bilan complet',
    'orientation finale',
    'analyse complète',
    'full report',
    'my report',
    'generate my report',
]

/**
 * Marqueur de la 7e (dernière) dimension de la Phase 2.
 * Le prompt impose le compteur "(D7/7)" sur la dernière question d'orientation :
 * dès que l'élève y répond, la réponse suivante est OBLIGATOIREMENT le rapport complet.
 * C'est le signal le plus fiable (déterministe) pour basculer en mode Sonnet + max_tokens élevé.
 * Tolère "(D7/7)", "D7 / 7", "d7/7", etc.
 */
const LAST_DIMENSION_MARKER = /\bD\s*7\s*\/\s*7\b/i

/**
 * Phrases signalant que l’IA s’apprête à (ou vient d’) annoncer/générer le rapport.
 * Couvre les variantes que le modèle produit en pratique.
 */
const ASSISTANT_REPORT_IMMINENT = [
    // Annonces explicites du prompt système
    ‘dernière question avant’,
    ‘derniere question avant’,
    ‘avant que je construise ton rapport’,
    ‘avant que je construise votre rapport’,
    ‘je construise ton rapport’,
    ‘je construis ton rapport’,
    // Variantes fréquentes produites par le modèle (non couvertes avant)
    ‘je vais construire ton rapport’,
    ‘je vais maintenant construire’,
    ‘construire ton rapport d\’orientation’,
    ‘construire votre rapport d\’orientation’,
    ‘je vais générer ton rapport’,
    ‘je vais maintenant générer’,
    ‘je vais rédiger ton rapport’,
    ‘je construis maintenant ton rapport’,
    ‘voici ton rapport d\’orientation’,
    ‘voici ton rapport d’orientation’,
    ‘voici votre rapport d\’orientation’,
    ‘analyse complète de ton profil’,
    ‘j\’ai maintenant toutes les informations’,
    ‘j\’ai toutes les informations nécessaires’,
    ‘j\’ai maintenant tous les éléments’,
    ‘génère le rapport sans délai’,
    ‘genere le rapport sans delai’,
    // Anglais
    ‘let me build your report’,
    ‘let me now generate’,
    ‘i now have all the information’,
    ‘i have all the information’,
    ‘i have all the details’,
    ‘building your report’,
    ‘generating your report’,
]

/**
 * Nombre de messages assistant récents à inspecter.
 * Couvre le cas où l’IA a annoncé le rapport dans un message antérieur
 * et génère maintenant le rapport en réponse au message suivant de l’élève.
 */
const REPORT_LOOKBACK = 3

/**
 * True → utiliser Sonnet + XKORIENTA_MAX_TOKENS (rapport ---RAPPORT---).
 * False → Haiku, conversation libre.
 */
export function isXkorientaReportPhase(messages: OrientationChatMessage[]): boolean {
    // 1. Phrase de rapport explicite dans le dernier message utilisateur
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role !== ‘user’) continue
        const user = messages[i].content.trim().toLowerCase()
        if (USER_REPORT_PHRASES.some((p) => user.includes(p))) return true
        break
    }

    // 2. Inspecter les REPORT_LOOKBACK derniers messages assistant :
    //    - Signal déterministe : compteur (D7/7) dans la question d’orientation
    //    - Signal sémantique  : phrase annonçant la génération imminente du rapport
    let assistantSeen = 0
    for (let i = messages.length - 1; i >= 0 && assistantSeen < REPORT_LOOKBACK; i--) {
        if (messages[i].role !== ‘assistant’) continue
        assistantSeen++
        const content = messages[i].content

        if (LAST_DIMENSION_MARKER.test(content)) return true

        const lower = content.toLowerCase()
        if (ASSISTANT_REPORT_IMMINENT.some((p) => lower.includes(p))) return true
    }

    return false
}
