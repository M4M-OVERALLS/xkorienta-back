import { NextResponse } from 'next/server'
import { guestPurchaseRepository } from '@/lib/repositories/GuestPurchaseRepository'
import { paymentSDK } from '@/lib/payment'
import { GuestBookPurchaseService } from '@/lib/services/GuestBookPurchaseService'

type Params = { params: Promise<{ reference: string }> }

/**
 * GET /api/books/purchase/guest/status/:reference[?providerRef=...]
 * Public status lookup for guest checkout return flow.
 *
 * NOTE: Uses the NotchPay provider directly instead of paymentSDK.payments.verifyPayment()
 * because guest purchases have no Transaction document in the Transaction collection.
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

        if (status === 'PENDING') {
            try {
                // Use the NotchPay provider directly — paymentSDK.payments.verifyPayment()
                // requires a Transaction document which guest purchases don't create.
                const lookupRef = providerRef || reference
                const provider = paymentSDK.providers.get('notchpay')
                const result = await provider.verifyPayment(lookupRef)

                // Map provider status to our enum
                const providerStatus = result.status?.toLowerCase() ?? ''
                const isCompleted = providerStatus === 'complete' || providerStatus === 'completed'
                const isFailed   = providerStatus === 'failed'  || providerStatus === 'cancelled' || providerStatus === 'expired'

                if (isCompleted) {
                    await guestPurchaseRepository.updateStatusByReference(reference, 'COMPLETED')
                    await GuestBookPurchaseService.handleGuestPurchaseCompleted(purchase)
                    status = 'COMPLETED'
                } else if (isFailed) {
                    await guestPurchaseRepository.updateStatusByReference(reference, 'FAILED')
                    status = 'FAILED'
                }
            } catch (error) {
                console.error(
                    `[GuestPurchaseStatus] Verification failed for ${reference} (providerRef=${providerRef ?? 'none'}):`,
                    (error as Error).message
                )
            }
        }

        return NextResponse.json({
            success: true,
            data: { reference, status, email: purchase.email },
        })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message || 'Erreur interne' },
            { status: 500 }
        )
    }
}
