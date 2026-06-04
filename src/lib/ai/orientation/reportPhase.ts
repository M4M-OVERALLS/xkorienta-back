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

/** Dernier message assistant : l'IA va produire le rapport à la réponse suivante */
const ASSISTANT_REPORT_IMMINENT = [
    'dernière question avant',
    'derniere question avant',
    'avant que je construise ton rapport',
    'avant que je construise votre rapport',
    'je construise ton rapport',
    'je construis ton rapport',
    'voici ton rapport d\'orientation',
    'voici ton rapport d’orientation',
    'voici votre rapport d\'orientation',
    'analyse complète de ton profil',
    'génère le rapport sans délai',
    'genere le rapport sans delai',
]

function lastMessage(
    messages: OrientationChatMessage[],
    role: 'user' | 'assistant',
): OrientationChatMessage | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === role) return messages[i]
    }
    return undefined
}

/**
 * True → utiliser Sonnet + XKORIENTA_MAX_TOKENS (rapport ---RAPPORT---).
 * False → Haiku, conversation libre.
 */
export function isXkorientaReportPhase(messages: OrientationChatMessage[]): boolean {
    const lastUser = lastMessage(messages, 'user')
    if (lastUser) {
        const user = lastUser.content.trim().toLowerCase()
        if (USER_REPORT_PHRASES.some((p) => user.includes(p))) return true
    }

    const lastAssistant = lastMessage(messages, 'assistant')
    if (lastAssistant) {
        // Signal déterministe : la dernière question posée portait le compteur "(D7/7)"
        // → la réponse de l'élève déclenche la génération du rapport complet.
        if (LAST_DIMENSION_MARKER.test(lastAssistant.content)) return true

        const assistant = lastAssistant.content.toLowerCase()
        if (ASSISTANT_REPORT_IMMINENT.some((p) => assistant.includes(p))) return true
    }

    return false
}
