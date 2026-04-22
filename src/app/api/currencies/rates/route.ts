import { CurrencyController } from '@/lib/controllers/CurrencyController'

/** GET /api/currencies/rates — Get current exchange rates */
export async function GET() {
    return CurrencyController.getRates()
}
