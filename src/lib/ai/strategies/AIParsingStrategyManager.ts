/**
 * AI Parsing Strategy Manager
 *
 * Meme pattern que AuthStrategyManager : singleton + registry.
 * Selectionne la strategie IA active via AI_PARSING_PROVIDER (env).
 *
 * Pour ajouter un nouveau provider :
 * 1. Creer OpenAIParsingStrategy.ts implementant IAIParsingStrategy
 * 2. L'enregistrer dans registerStrategies()
 * 3. Changer AI_PARSING_PROVIDER=openai dans .env
 */

import { IAIParsingStrategy } from './IAIParsingStrategy'
import { HuggingFaceParsingStrategy } from './HuggingFaceParsingStrategy'
import { AnthropicParsingStrategy } from './AnthropicParsingStrategy'

const DEFAULT_PROVIDER = 'huggingface'

export class AIParsingStrategyManager {
    private static instance: AIParsingStrategyManager
    private strategies: Map<string, IAIParsingStrategy> = new Map()

    private constructor() {
        this.registerStrategies()
    }

    /**
     * Singleton
     */
    static getInstance(): AIParsingStrategyManager {
        if (!AIParsingStrategyManager.instance) {
            AIParsingStrategyManager.instance = new AIParsingStrategyManager()
        }
        return AIParsingStrategyManager.instance
    }

    /**
     * Enregistrer toutes les strategies disponibles.
     * Pour ajouter un nouveau provider, l'ajouter ici.
     */
    private registerStrategies(): void {
        this.registerStrategy(new AnthropicParsingStrategy())
        this.registerStrategy(new HuggingFaceParsingStrategy())
        // Futurs providers :
        // this.registerStrategy(new OpenAIParsingStrategy())
    }

    private registerStrategy(strategy: IAIParsingStrategy): void {
        this.strategies.set(strategy.id, strategy)
    }

    /**
     * Retourne la strategie active selon AI_PARSING_PROVIDER
     */
    getActiveStrategy(): IAIParsingStrategy {
        const providerId = process.env.AI_PARSING_PROVIDER || DEFAULT_PROVIDER
        const strategy = this.strategies.get(providerId)

        if (!strategy) {
            throw new Error(
                `AI parsing provider "${providerId}" not found. Available: ${Array.from(this.strategies.keys()).join(', ')}`
            )
        }

        return strategy
    }

    /**
     * Retourne une strategie par ID
     */
    getStrategy(id: string): IAIParsingStrategy | undefined {
        return this.strategies.get(id)
    }

    /**
     * Liste toutes les strategies enregistrees
     */
    getAllStrategies(): IAIParsingStrategy[] {
        return Array.from(this.strategies.values())
    }
}
