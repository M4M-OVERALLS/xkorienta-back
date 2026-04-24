import { NextResponse } from 'next/server'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'
import { PaymentStrategyFactory } from '@/lib/strategies/payment/PaymentStrategyFactory'
import { GuestBookPurchaseService } from '@/lib/services/GuestBookPurchaseService'

type Params = { params: Promise<{ reference: string }> }

/**
 * GET /api/books/purchase/guest/status/:reference[?providerRef=...]
 * Public status lookup for guest checkout return flow.
 *
 * - `:reference` is our internal merchant reference (stored in DB).
 * - `providerRef` (optional query) is the provider's internal reference
 *   (e.g. NotchPay's `trx.test_...`) forwarded by the return URL.
 *   Required for provider verification fallback because NotchPay
 *   indexes its lookup API on its own reference, not the merchant one.
 */
export async function GET(req: Request, { params }: Params) {
    try {
        const { reference } = await params
        const url = new URL(req.url)
        const providerRef = url.searchParams.get('providerRef')?.trim() || null

        const purchase = await guestPurchaseRepository.findByReference(reference)

        if (!purchase) {
            return NextResponse.json(
                { success: false, message: 'Référence introuvable' },
                { status: 404 }
            )
        }

        let status = purchase.status

        // Fallback: if webhook has not landed yet, ask the provider directly.
        // We use providerRef if given (reliable), otherwise our merchant ref
        // as a best-effort attempt (may 404 on NotchPay).
        if (status === 'PENDING') {
            const refForLookup = providerRef ?? reference
            try {
                const strategy = PaymentStrategyFactory.create(purchase.paymentProvider)
                const verification = await strategy.verifyPayment(refForLookup)

                if (verification.status === 'completed') {
                    await guestPurchaseRepository.updateStatusByReference(reference, 'COMPLETED')
                    await GuestBookPurchaseService.handleGuestPurchaseCompleted(purchase)
                    status = 'COMPLETED'
                } else if (verification.status === 'failed' || verification.status === 'cancelled') {
                    await guestPurchaseRepository.updateStatusByReference(reference, 'FAILED')
                    status = 'FAILED'
                }
            } catch (error) {
                console.error(
                    `[GuestPurchaseStatus] Verification fallback failed for ${reference} (providerRef=${providerRef ?? 'none'}):`,
                    (error as Error).message
                )
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                reference,
                status,
                email: purchase.email,
            },
        })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message || 'Erreur interne' },
            { status: 500 }
        )
    }
}
