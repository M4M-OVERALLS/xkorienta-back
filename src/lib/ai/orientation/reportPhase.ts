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
        const assistant = lastAssistant.content.toLowerCase()
        if (ASSISTANT_REPORT_IMMINENT.some((p) => assistant.includes(p))) return true
    }

    return false
}
