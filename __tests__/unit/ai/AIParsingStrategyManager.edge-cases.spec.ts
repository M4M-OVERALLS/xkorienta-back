/**
 * Agent 5 — Tests Complementaires : AIParsingStrategyManager
 *
 * Couvre les branches non testees : message d'erreur detaille,
 * verification des strategies enregistrees, singleton reset.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { AIParsingStrategyManager } from '@/lib/ai/strategies/AIParsingStrategyManager'

describe('AIParsingStrategyManager — Edge Cases', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    // =========================================
    // ERROR MESSAGE DETAILS
    // =========================================

    describe('getActiveStrategy — error message content', () => {
        it('devrait inclure le provider invalide dans le message d\'erreur', () => {
            process.env.AI_PARSING_PROVIDER = 'nonexistent-provider'
            const manager = AIParsingStrategyManager.getInstance()

            expect(() => manager.getActiveStrategy()).toThrow('nonexistent-provider')
        })

        it('devrait lister les providers disponibles dans le message d\'erreur', () => {
            process.env.AI_PARSING_PROVIDER = 'invalid'
            const manager = AIParsingStrategyManager.getInstance()

            expect(() => manager.getActiveStrategy()).toThrow('huggingface')
        })
    })

    // =========================================
    // STRATEGIES REGISTRY
    // =========================================

    describe('getAllStrategies — registry details', () => {
        it('devrait retourner des strategies avec toutes les proprietes requises', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategies = manager.getAllStrategies()

            for (const strategy of strategies) {
                expect(strategy).toHaveProperty('id')
                expect(strategy).toHaveProperty('name')
                expect(typeof strategy.isEnabled).toBe('function')
                expect(typeof strategy.parseToSyllabus).toBe('function')
            }
        })

        it('devrait retourner des strategies avec des IDs uniques', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategies = manager.getAllStrategies()
            const ids = strategies.map(s => s.id)
            const uniqueIds = new Set(ids)

            expect(uniqueIds.size).toBe(ids.length)
        })
    })

    // =========================================
    // GET STRATEGY
    // =========================================

    describe('getStrategy — additional cases', () => {
        it('devrait retourner undefined pour une chaine vide', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getStrategy('')

            expect(strategy).toBeUndefined()
        })

        it('devrait etre sensible a la casse', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getStrategy('HuggingFace')

            // Les IDs sont en minuscules
            expect(strategy).toBeUndefined()
        })

        it('devrait retourner undefined pour un ID avec des espaces', () => {
            const manager = AIParsingStrategyManager.getInstance()
            const strategy = manager.getStrategy(' huggingface ')

            expect(strategy).toBeUndefined()
        })
    })

    // =========================================
    // SINGLETON BEHAVIOR
    // =========================================

    describe('getInstance — singleton guarantees', () => {
        it('devrait retourner la meme instance a travers plusieurs appels', () => {
            const instances: AIParsingStrategyManager[] = []
            for (let i = 0; i < 100; i++) {
                instances.push(AIParsingStrategyManager.getInstance())
            }

            const firstInstance = instances[0]
            for (const instance of instances) {
                expect(instance).toBe(firstInstance)
            }
        })
    })
})
