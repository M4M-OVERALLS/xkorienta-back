import { IAuthStrategy } from "./AuthStrategy"
import { CredentialsAuthStrategy } from "./CredentialsStrategy"
// import { GoogleAuthStrategy } from "./GoogleStrategy" // A-07/A-18: disabled
import { GitHubAuthStrategy } from "./GitHubStrategy"
import { Provider } from "next-auth/providers/index"

/**
 * Auth Strategy Manager
 *
 * Centralized manager for all authentication strategies.
 * This class implements the Strategy Pattern to manage different auth providers.
 *
 * Usage:
 *   const manager = AuthStrategyManager.getInstance()
 *   const providers = manager.getEnabledProviders()
 */
export class AuthStrategyManager {
    private static instance: AuthStrategyManager
    private strategies: Map<string, IAuthStrategy> = new Map()

    private constructor() {
        this.registerStrategies()
    }

    /**
     * Singleton pattern to ensure only one instance
     */
    static getInstance(): AuthStrategyManager {
        if (!AuthStrategyManager.instance) {
            AuthStrategyManager.instance = new AuthStrategyManager()
        }
        return AuthStrategyManager.instance
    }

    /**
     * Register all available authentication strategies
     *
     * To add a new provider:
     * 1. Create a new strategy class (e.g., FacebookStrategy.ts)
     * 2. Add it here: this.registerStrategy(new FacebookAuthStrategy())
     */
    private registerStrategies() {
        // Register all strategies
        this.registerStrategy(new CredentialsAuthStrategy())

        // A-07/A-18: Google OAuth disabled until full frontend/backend alignment is deployed
        // Re-enable when GOOGLE_CLIENT_ID/SECRET are properly configured on both sides
        // and allowDangerousEmailAccountLinking is set to false
        // this.registerStrategy(new GoogleAuthStrategy())

        this.registerStrategy(new GitHubAuthStrategy())

        // Add more strategies here:
        // this.registerStrategy(new FacebookAuthStrategy())
        // this.registerStrategy(new MicrosoftAuthStrategy())
        // this.registerStrategy(new AppleAuthStrategy())
    }

    /**
     * Register a single strategy
     */
    private registerStrategy(strategy: IAuthStrategy) {
        this.strategies.set(strategy.id, strategy)
    }

    /**
     * Get a specific strategy by ID
     */
    getStrategy(id: string): IAuthStrategy | undefined {
        return this.strategies.get(id)
    }

    /**
     * Get all registered strategies
     */
    getAllStrategies(): IAuthStrategy[] {
        return Array.from(this.strategies.values())
    }

    /**
     * Get only enabled strategies (those with valid configuration)
     */
    getEnabledStrategies(): IAuthStrategy[] {
        return this.getAllStrategies().filter(s => s.isEnabled())
    }

    /**
     * Get NextAuth providers for all enabled strategies
     */
    getEnabledProviders(): Provider[] {
        return this.getEnabledStrategies().map(s => s.getProvider())
    }

    /**
     * Get enabled strategies for display in UI
     */
    getUIStrategies(): Array<{
        id: string
        name: string
        icon?: string
    }> {
        return this.getEnabledStrategies().map(s => ({
            id: s.id,
            name: s.name,
            icon: s.icon
        }))
    }

    /**
     * Handle sign-in for a specific strategy
     */
    async handleSignIn(
        strategyId: string,
        profile: any,
        account: any
    ): Promise<boolean> {
        const strategy = this.getStrategy(strategyId)

        if (!strategy || !strategy.handleSignIn) {
            console.warn(`[AuthStrategyManager] No sign-in handler for strategy: ${strategyId}`)
            return true // Continue anyway
        }

        return strategy.handleSignIn(profile, account)
    }

    /**
     * Check if a specific provider is enabled
     */
    isProviderEnabled(id: string): boolean {
        const strategy = this.getStrategy(id)
        return strategy ? strategy.isEnabled() : false
    }

    /**
     * Get configuration status for debugging
     */
    getConfigStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {}

        this.getAllStrategies().forEach(strategy => {
            status[strategy.id] = strategy.isEnabled()
        })

        return status
    }
}

/**
 * Export singleton instance for convenience
 */
export const authStrategyManager = AuthStrategyManager.getInstance()
