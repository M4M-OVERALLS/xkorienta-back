import { NextResponse } from 'next/server'
import { CurrencyService } from '@/lib/services/CurrencyService'

export class CurrencyController {
    /**
     * GET /api/currencies
     * Get list of supported currencies.
     */
    static async getSupportedCurrencies() {
        const currencies = CurrencyService.getSupportedCurrencies()

        return NextResponse.json({
            success: true,
            data: {
                currencies,
                default: 'XAF',
            },
        })
    }

    /**
     * GET /api/currencies/rates
     * Get current exchange rates.
     */
    static async getRates() {
        const rates = await CurrencyService.getAllRates()
        const fallbackRates = CurrencyService.getFallbackRates()

        return NextResponse.json({
            success: true,
            data: {
                live: rates,
                fallback: fallbackRates,
            },
        })
    }

    /**
     * POST /api/currencies/convert
     * Convert an amount between currencies.
     */
    static async convert(req: Request) {
        const body = await req.json() as {
            amount: number
            from: string
            to: string
        }

        if (!body.amount || !body.from || !body.to) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields: amount, from, to' },
                { status: 400 }
            )
        }

        if (typeof body.amount !== 'number' || body.amount <= 0) {
            return NextResponse.json(
                { success: false, message: 'Amount must be a positive number' },
                { status: 400 }
            )
        }

        if (!CurrencyService.isSupportedCurrency(body.from)) {
            return NextResponse.json(
                { success: false, message: `Currency ${body.from} is not supported` },
                { status: 400 }
            )
        }

        if (!CurrencyService.isSupportedCurrency(body.to)) {
            return NextResponse.json(
                { success: false, message: `Currency ${body.to} is not supported` },
                { status: 400 }
            )
        }

        const result = await CurrencyService.convert(body.amount, body.from, body.to)

        return NextResponse.json({
            success: true,
            data: result,
        })
    }

    /**
     * POST /api/admin/currencies/refresh
     * Admin: Refresh exchange rates from API.
     */
    static async refreshRates() {
        await CurrencyService.refreshRates('XAF')

        return NextResponse.json({
            success: true,
            message: 'Exchange rates refreshed',
        })
    }
}
