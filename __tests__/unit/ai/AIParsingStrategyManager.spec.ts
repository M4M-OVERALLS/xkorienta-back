/**
 * TDD Tests — AIParsingStrategyManager
 *
 * Teste le Strategy Pattern pour le parsing IA.
 * Le manager doit selectionner la bonne strategie selon AI_PARSING_PROVIDER.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { AIParsingStrategyManager } from '@/lib/ai/strategies/AIParsingStrategyManager'

describe('AIParsingStrategyManager', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('getInstance', () => {
        it('devrait retourner un singleton', () => {
            const a = AIParsingStrategyManager.getInstance()
            const b = AIParsingStrategyManager.getInstance()
            expect(a).toBe(b)
        })
    })

    describe('getActiveStrategy', () => {
        it('devrait retourner la strategie HuggingFace par defaut', () => {
            process.env.AI_PARSING_PROVIDER = 'huggingface'
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getActiveStrategy()

            expect(strategy).toBeDefined()
            expect(strategy.id).toBe('huggingface')
        })

        it('devrait retourner la strategie configuree via env', () => {
            process.env.AI_PARSING_PROVIDER = 'huggingface'
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getActiveStrategy()

            expect(strategy.id).toBe('huggingface')
        })

        it('devrait fallback sur huggingface si le provider n\'est pas configure', () => {
            delete process.env.AI_PARSING_PROVIDER
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getActiveStrategy()

            expect(strategy.id).toBe('huggingface')
        })

        it('devrait lancer une erreur si le provider configure n\'existe pas', () => {
            process.env.AI_PARSING_PROVIDER = 'nonexistent'
            const manager = AIParsingStrategyManager.getInstance()

            expect(() => manager.getActiveStrategy()).toThrow()
        })
    })

    describe('getAllStrategies', () => {
        it('devrait retourner au moins une strategie', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategies = manager.getAllStrategies()

            expect(strategies.length).toBeGreaterThanOrEqual(1)
        })

        it('devrait inclure huggingface dans les strategies', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategies = manager.getAllStrategies()
            const ids = strategies.map(s => s.id)

            expect(ids).toContain('huggingface')
        })
    })

    describe('getStrategy', () => {
        it('devrait retourner une strategie par ID', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getStrategy('huggingface')

            expect(strategy).toBeDefined()
            expect(strategy?.id).toBe('huggingface')
        })

        it('devrait retourner undefined pour un ID inconnu', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getStrategy('unknown')

            expect(strategy).toBeUndefined()
        })
    })
})
