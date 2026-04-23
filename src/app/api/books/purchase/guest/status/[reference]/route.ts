import { NextResponse } from 'next/server'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'
import { PaymentStrategyFactory } from '@/lib/strategies/payment/PaymentStrategyFactory'
import { GuestBookPurchaseService } from '@/lib/services/GuestBookPurchaseService'

type Params = { params: Promise<{ reference: string }> }

/**
 * GET /api/books/purchase/guest/status/:reference
 * Public status lookup for guest checkout return flow.
 */
export async function GET(_req: Request, { params }: Params) {
    try {
        const { reference } = await params
        const purchase = await guestPurchaseRepository.findByReference(reference)

        if (!purchase) {
            return NextResponse.json(
                { success: false, message: 'Référence introuvable' },
                { status: 404 }
            )
        }

        let status = purchase.status

        // Fallback de sécurité:
        // si le webhook ne passe pas (signature/proxy/url), on vérifie
        // explicitement l'état chez le provider pour débloquer le flux invité.
        if (status === 'PENDING') {
            try {
                const strategy = PaymentStrategyFactory.create(purchase.paymentProvider)
                const verification = await strategy.verifyPayment(reference)

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
                    `[GuestPurchaseStatus] Verification fallback failed for ${reference}:`,
                    (error as Error).message
                )
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                reference,
                status,
            },
        })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message || 'Erreur interne' },
            { status: 500 }
        )
    }
}

