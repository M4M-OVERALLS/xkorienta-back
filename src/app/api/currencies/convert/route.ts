import { NextResponse } from 'next/server'
import { CurrencyController } from '@/lib/controllers/CurrencyController'

/** POST /api/currencies/convert — Convert amount between currencies */
export async function POST(req: Request) {
    try {
        return await CurrencyController.convert(req)
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
