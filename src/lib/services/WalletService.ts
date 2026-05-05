import { walletRepository } from '@/lib/repositories/WalletRepository'
import { IWallet } from '@/models/Wallet'
import { Currency } from '@/models/enums'

export interface WalletSummary {
    balance: number
    totalEarned: number
    totalWithdrawn: number
    currency: Currency
    lastUpdatedAt: Date
}

export class WalletService {
    /**
     * Crédite les gains d'un vendeur après la complétion d'une vente.
     * Crée le wallet s'il n'existe pas encore.
     */
    static async creditSeller(
        sellerId: string,
        amount: number,
        currency: Currency
    ): Promise<IWallet> {
        return walletRepository.credit(sellerId, amount, currency)
    }

    /**
     * Retourne le résumé du wallet d'un vendeur.
     */
    static async getWallet(userId: string): Promise<WalletSummary | null> {
        const wallet = await walletRepository.findByUserId(userId)
        if (!wallet) return null

        return {
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn,
            currency: wallet.currency,
            lastUpdatedAt: wallet.lastUpdatedAt,
        }
    }

    /**
     * Débite le wallet lors de l'exécution d'un virement.
     */
    static async debit(userId: string, amount: number): Promise<IWallet> {
        return walletRepository.debit(userId, amount)
    }
}
