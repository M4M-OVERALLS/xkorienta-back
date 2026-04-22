import { exchangeRateRepository, ExchangeRateData } from '@/lib/repositories/ExchangeRateRepository'
import { Currency } from '@/models/enums'

const EXCHANGE_RATE_API_BASE = 'https://v6.exchangerate-api.com/v6'
const CACHE_TTL_HOURS = 1
const SUPPORTED_CURRENCIES = Object.values(Currency)

// Fallback rates when API is unavailable (1 XAF = X target)
const FALLBACK_RATES: Record<string, Record<string, number>> = {
    XAF: {
        EUR: 0.001524,  // 1 EUR = 656 XAF
        USD: 0.001667,  // 1 USD = 600 XAF
        XAF: 1,
    },
    EUR: {
        XAF: 656,
        USD: 1.09,
        EUR: 1,
    },
    USD: {
        XAF: 600,
        EUR: 0.917,
        USD: 1,
    },
}

export interface ConversionResult {
    originalAmount: number
    originalCurrency: string
    convertedAmount: number
    targetCurrency: string
    exchangeRate: number
    source: 'live' | 'cached' | 'fallback'
}

export interface ExchangeRateInfo {
    baseCurrency: string
    targetCurrency: string
    rate: number
    inverseRate: number
    source: string
    fetchedAt: Date
    isExpired: boolean
}

export class CurrencyService {
    private static getApiKey(): string | null {
        return process.env.EXCHANGE_RATE_API_KEY ?? null
    }

    /**
     * Convert an amount from one currency to another.
     * Uses cached rates, live API, or fallback rates as needed.
     */
    static async convert(
        amount: number,
        from: string,
        to: string
    ): Promise<ConversionResult> {
        const fromUpper = from.toUpperCase()
        const toUpper = to.toUpperCase()

        // Same currency - no conversion needed
        if (fromUpper === toUpper) {
            return {
                originalAmount: amount,
                originalCurrency: fromUpper,
                convertedAmount: amount,
                targetCurrency: toUpper,
                exchangeRate: 1,
                source: 'cached',
            }
        }

        // Try to get rate
        const { rate, source } = await this.getRateWithSource(fromUpper, toUpper)
        const convertedAmount = Math.round(amount * rate * 100) / 100

        return {
            originalAmount: amount,
            originalCurrency: fromUpper,
            convertedAmount,
            targetCurrency: toUpper,
            exchangeRate: rate,
            source,
        }
    }

    /**
     * Get the exchange rate between two currencies.
     */
    static async getRate(from: string, to: string): Promise<number> {
        const { rate } = await this.getRateWithSource(from.toUpperCase(), to.toUpperCase())
        return rate
    }

    /**
     * Get rate with source information.
     */
    private static async getRateWithSource(
        from: string,
        to: string
    ): Promise<{ rate: number; source: 'live' | 'cached' | 'fallback' }> {
        // Same currency
        if (from === to) {
            return { rate: 1, source: 'cached' }
        }

        // Try cached rate first
        const cached = await exchangeRateRepository.findValidByPair(from, to)
        if (cached) {
            return { rate: cached.rate, source: 'cached' }
        }

        // Try to fetch live rate
        const apiKey = this.getApiKey()
        if (apiKey) {
            try {
                const liveRate = await this.fetchLiveRate(apiKey, from, to)
                if (liveRate !== null) {
                    return { rate: liveRate, source: 'live' }
                }
            } catch (error) {
                console.error('[CurrencyService] Failed to fetch live rate:', error)
            }
        }

        // Fallback to static rates
        const fallbackRate = this.getFallbackRate(from, to)
        return { rate: fallbackRate, source: 'fallback' }
    }

    /**
     * Fetch live exchange rate from API.
     */
    private static async fetchLiveRate(
        apiKey: string,
        from: string,
        to: string
    ): Promise<number | null> {
        try {
            const response = await fetch(
                `${EXCHANGE_RATE_API_BASE}/${apiKey}/pair/${from}/${to}`,
                { next: { revalidate: 3600 } } // Cache for 1 hour
            )

            if (!response.ok) {
                console.error('[CurrencyService] API error:', response.status)
                return null
            }

            const data = await response.json() as {
                result: string
                conversion_rate?: number
            }

            if (data.result !== 'success' || !data.conversion_rate) {
                return null
            }

            // Cache the rate
            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS)

            await exchangeRateRepository.upsert({
                baseCurrency: from as Currency,
                targetCurrency: to as Currency,
                rate: data.conversion_rate,
                inverseRate: 1 / data.conversion_rate,
                source: 'exchangerate-api.com',
                expiresAt,
            })

            return data.conversion_rate
        } catch (error) {
            console.error('[CurrencyService] Fetch error:', error)
            return null
        }
    }

    /**
     * Get fallback rate from static configuration.
     */
    private static getFallbackRate(from: string, to: string): number {
        // Direct rate exists
        if (FALLBACK_RATES[from]?.[to]) {
            return FALLBACK_RATES[from][to]
        }

        // Try inverse
        if (FALLBACK_RATES[to]?.[from]) {
            return 1 / FALLBACK_RATES[to][from]
        }

        // Cross-rate through XAF
        if (from !== 'XAF' && to !== 'XAF') {
            const fromToXaf = FALLBACK_RATES[from]?.XAF ?? (1 / (FALLBACK_RATES.XAF?.[from] ?? 1))
            const xafToTarget = FALLBACK_RATES.XAF?.[to] ?? (1 / (FALLBACK_RATES[to]?.XAF ?? 1))
            return fromToXaf * xafToTarget
        }

        console.warn(`[CurrencyService] No rate found for ${from} -> ${to}, using 1`)
        return 1
    }

    /**
     * Refresh all rates for a base currency.
     */
    static async refreshRates(baseCurrency: string = 'XAF'): Promise<void> {
        const apiKey = this.getApiKey()
        if (!apiKey) {
            console.warn('[CurrencyService] No API key configured, using fallback rates')
            return
        }

        try {
            const response = await fetch(
                `${EXCHANGE_RATE_API_BASE}/${apiKey}/latest/${baseCurrency.toUpperCase()}`
            )

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`)
            }

            const data = await response.json() as {
                result: string
                conversion_rates?: Record<string, number>
            }

            if (data.result !== 'success' || !data.conversion_rates) {
                throw new Error('Invalid API response')
            }

            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS)

            const ratesToUpsert: ExchangeRateData[] = SUPPORTED_CURRENCIES
                .filter((currency) => currency !== baseCurrency && data.conversion_rates![currency])
                .map((currency) => ({
                    baseCurrency: baseCurrency as Currency,
                    targetCurrency: currency,
                    rate: data.conversion_rates![currency],
                    inverseRate: 1 / data.conversion_rates![currency],
                    source: 'exchangerate-api.com',
                    expiresAt,
                }))

            await exchangeRateRepository.upsertMany(ratesToUpsert)
            console.log(`[CurrencyService] Refreshed ${ratesToUpsert.length} rates for ${baseCurrency}`)
        } catch (error) {
            console.error('[CurrencyService] Failed to refresh rates:', error)
        }
    }

    /**
     * Get all current exchange rates.
     */
    static async getAllRates(): Promise<ExchangeRateInfo[]> {
        const rates = await exchangeRateRepository.findAllValid()
        const now = new Date()

        return rates.map((r) => ({
            baseCurrency: r.baseCurrency,
            targetCurrency: r.targetCurrency,
            rate: r.rate,
            inverseRate: r.inverseRate,
            source: r.source,
            fetchedAt: r.fetchedAt,
            isExpired: r.expiresAt < now,
        }))
    }

    /**
     * Get list of supported currencies.
     */
    static getSupportedCurrencies(): string[] {
        return [...SUPPORTED_CURRENCIES]
    }

    /**
     * Check if a currency is supported.
     */
    static isSupportedCurrency(currency: string): boolean {
        return SUPPORTED_CURRENCIES.includes(currency.toUpperCase() as Currency)
    }

    /**
     * Get fallback rates (for display when API is unavailable).
     */
    static getFallbackRates(): Record<string, Record<string, number>> {
        return { ...FALLBACK_RATES }
    }
}
