import { describe, it, expect } from '@jest/globals'
import { isXkorientaReportPhase } from '@/lib/ai/orientation/reportPhase'

describe('isXkorientaReportPhase', () => {
    it('should stay false for a long casual conversation', () => {
        const messages = Array.from({ length: 25 }, (_, i) => ({
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: i % 2 === 0 ? `Réponse élève ${i}` : `Question conseiller ${i}`,
        }))
        expect(isXkorientaReportPhase(messages)).toBe(false)
    })

    it('should be true when user sends /rapport', () => {
        expect(
            isXkorientaReportPhase([
                { role: 'user', content: '/rapport' },
            ]),
        ).toBe(true)
    })

    it('should be true when user asks for full report explicitly', () => {
        expect(
            isXkorientaReportPhase([
                { role: 'assistant', content: 'Parle-moi de tes matières.' },
                { role: 'user', content: 'Donne-moi mon rapport d\'orientation complet maintenant.' },
            ]),
        ).toBe(true)
    })

    it('should be true when assistant announced imminent report', () => {
        expect(
            isXkorientaReportPhase([
                {
                    role: 'assistant',
                    content:
                        'Dernière question avant que je construise ton rapport : as-tu des contraintes ?',
                },
                { role: 'user', content: 'Pas de contrainte majeure' },
            ]),
        ).toBe(true)
    })

    it('should not trigger on vague mention of rapport in middle of chat', () => {
        expect(
            isXkorientaReportPhase([
                { role: 'assistant', content: 'Ton rapport sera personnalisé plus tard.' },
                { role: 'user', content: 'Ok merci' },
            ]),
        ).toBe(false)
    })
})
