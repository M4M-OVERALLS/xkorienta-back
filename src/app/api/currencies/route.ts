import { CurrencyController } from '@/lib/controllers/CurrencyController'

/** GET /api/currencies — Get supported currencies */
export async function GET() {
    return CurrencyController.getSupportedCurrencies()
}
