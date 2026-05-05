import { NextResponse } from 'next/server'
import { paymentSDK } from '@/lib/payment'
import { exchangeRateRepository } from '@/lib/repositories/ExchangeRateRepository'

const SUPPORTED_CURRENCIES = ['XAF', 'EUR', 'USD']

const FALLBACK_RATES: Record<string, Record<string, number>> = {
    XAF: { EUR: 0.001524, USD: 0.001667, XAF: 1 },
    EUR: { XAF: 656, USD: 1.09, EUR: 1 },
    USD: { XAF: 600, EUR: 0.917, USD: 1 },
}

export class CurrencyController {
    static async getSupportedCurrencies() {
        return NextResponse.json({
            success: true,
            data: { currencies: SUPPORTED_CURRENCIES, default: 'XAF' },
        })
    }

    static async getRates() {
        const rates = await exchangeRateRepository.findAllValid()
        const now = new Date()
        const live = rates.map((r) => ({
            baseCurrency: r.baseCurrency,
            targetCurrency: r.targetCurrency,
            rate: r.rate,
            inverseRate: r.inverseRate,
            source: r.source,
            fetchedAt: r.fetchedAt,
            isExpired: r.expiresAt < now,
        }))
        return NextResponse.json({ success: true, data: { live, fallback: FALLBACK_RATES } })
    }

    static async convert(req: Request) {
        const body = await req.json() as { amount: number; from: string; to: string }

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

        const fromUpper = body.from.toUpperCase()
        const toUpper = body.to.toUpperCase()

        if (!SUPPORTED_CURRENCIES.includes(fromUpper)) {
            return NextResponse.json({ success: false, message: `Currency ${body.from} is not supported` }, { status: 400 })
        }
        if (!SUPPORTED_CURRENCIES.includes(toUpper)) {
            return NextResponse.json({ success: false, message: `Currency ${body.to} is not supported` }, { status: 400 })
        }

        const result = await paymentSDK.currency.convert(body.amount, fromUpper, toUpper)
        return NextResponse.json({ success: true, data: result })
    }

    static async refreshRates() {
        await paymentSDK.currency.refreshRates('XAF')
        return NextResponse.json({ success: true, message: 'Exchange rates refreshed' })
    }
}
