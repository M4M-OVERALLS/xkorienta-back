import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WalletService } from '@/lib/services/WalletService'

/**
 * GET /api/seller/wallet
 * Retourne le solde et les statistiques du wallet du vendeur connecté.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }

        const wallet = await WalletService.getWallet(session.user.id as string)

        if (!wallet) {
            // Wallet n'existe pas encore = aucune vente réalisée
            return NextResponse.json({
                success: true,
                data: {
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    currency: 'XAF',
                    lastUpdatedAt: null,
                },
            })
        }

        return NextResponse.json({ success: true, data: wallet })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
