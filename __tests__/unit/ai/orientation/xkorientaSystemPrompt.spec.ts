/**
 * Tests Unitaires — xkorientaSystemPrompt
 *
 * Verifie que le système de prompt d'orientation Xkorienta
 * génère les bons contenus selon la langue, que cleanOutput
 * filtre correctement les artefacts, et que les constantes
 * de configuration ont les valeurs attendues.
 */

import { describe, it, expect } from '@jest/globals'
import {
    getXkorientaSystemPrompt,
    cleanOutput,
    XKORIENTA_CONTEXT_WINDOW,
    XKORIENTA_ANCHOR_SIZE,
    XKORIENTA_TEMPERATURE,
    XKORIENTA_MAX_TOKENS,
    XKORIENTA_CHAT_MAX_TOKENS,
} from '@/lib/ai/prompts/xkorientaSystemPrompt'

// =========================================
// getXkorientaSystemPrompt
// =========================================

describe('getXkorientaSystemPrompt', () => {
    it('should include BTS catalog for fr language', () => {
        const result = getXkorientaSystemPrompt('fr')

        expect(result).toContain('CATALOGUE OFFICIEL BTS')
    })

    it('should include Génie Logiciel entry for fr language', () => {
        const result = getXkorientaSystemPrompt('fr')

        expect(result).toContain('Génie Logiciel')
    })

    it('should NOT include HND catalog entries for fr language', () => {
        const result = getXkorientaSystemPrompt('fr')

        // PROMPT_HND_CATALOG contains the HND catalog header — absent in fr
        expect(result).not.toContain('CATALOGUE OFFICIEL HND')
    })

    it('should include HND catalog for en language', () => {
        const result = getXkorientaSystemPrompt('en')

        expect(result).toContain('Software Engineering')
    })

    it('should NOT include BTS catalog for en language', () => {
        const result = getXkorientaSystemPrompt('en')

        expect(result).not.toContain('CATALOGUE OFFICIEL BTS')
    })

    it('should include both catalogs when language is undefined', () => {
        const result = getXkorientaSystemPrompt()

        expect(result).toContain('Génie Logiciel')
        expect(result).toContain('Software Engineering')
    })

    it('should always include the common sections', () => {
        const resultFr = getXkorientaSystemPrompt('fr')
        const resultEn = getXkorientaSystemPrompt('en')
        const resultDefault = getXkorientaSystemPrompt()

        for (const result of [resultFr, resultEn, resultDefault]) {
            expect(result).toContain('PHILOSOPHIE')
            expect(result).toContain('RÈGLES ABSOLUES')
        }
    })

    it('should always include the prose format rule', () => {
        const resultFr = getXkorientaSystemPrompt('fr')
        const resultEn = getXkorientaSystemPrompt('en')

        expect(resultFr).toContain('prose naturelle et humaine')
        expect(resultEn).toContain('prose naturelle et humaine')
    })
})

// =========================================
// cleanOutput
// =========================================

describe('cleanOutput', () => {
    it('should remove bullet points at start of lines', () => {
        const result = cleanOutput('• Hello\n• World')

        expect(result).toBe('Hello\nWorld')
    })

    it('should remove dashes at start of lines', () => {
        const result = cleanOutput('- item\n— autre')

        expect(result).not.toMatch(/^[-—]/m)
    })

    it('should replace | separators with commas', () => {
        const result = cleanOutput('A | B | C')

        expect(result).toBe('A, B, C')
    })

    it('should trim leading and trailing whitespace from the result', () => {
        // cleanOutput trims the whole string but only removes bullets at line start
        const result = cleanOutput('• Hello  ')

        expect(result).toBe('Hello')
    })

    it('should return unchanged text when no bullets or pipes', () => {
        const result = cleanOutput('Hello world')

        expect(result).toBe('Hello world')
    })

    it('should handle empty string', () => {
        const result = cleanOutput('')

        expect(result).toBe('')
    })
})

// =========================================
// Configuration constants
// =========================================

describe('configuration constants', () => {
    it('XKORIENTA_CONTEXT_WINDOW should be 30', () => {
        expect(XKORIENTA_CONTEXT_WINDOW).toBe(30)
    })

    it('XKORIENTA_ANCHOR_SIZE should be 4', () => {
        expect(XKORIENTA_ANCHOR_SIZE).toBe(4)
    })

    it('XKORIENTA_TEMPERATURE should be 0.8', () => {
        expect(XKORIENTA_TEMPERATURE).toBe(0.8)
    })

    it('XKORIENTA_MAX_TOKENS should be 5000', () => {
        expect(XKORIENTA_MAX_TOKENS).toBe(5000)
    })

    it('XKORIENTA_CHAT_MAX_TOKENS should be 1200', () => {
        expect(XKORIENTA_CHAT_MAX_TOKENS).toBe(1200)
    })
})
