import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Wallet, { IWallet } from '@/models/Wallet'
import { Currency } from '@/models/enums'

export class WalletRepository {
    /**
     * Récupère le wallet d'un vendeur, le crée s'il n'existe pas.
     */
    async getOrCreate(userId: string, currency: Currency = Currency.XAF): Promise<IWallet> {
        await connectDB()
        const existing = await Wallet.findOne({
            userId: new mongoose.Types.ObjectId(userId),
        }).lean() as IWallet | null

        if (existing) return existing

        return Wallet.create({
            userId: new mongoose.Types.ObjectId(userId),
            currency,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            lastUpdatedAt: new Date(),
        })
    }

    async findByUserId(userId: string): Promise<IWallet | null> {
        await connectDB()
        return Wallet.findOne({
            userId: new mongoose.Types.ObjectId(userId),
        }).lean() as Promise<IWallet | null>
    }

    /**
     * Crédite le wallet : incrémente balance et totalEarned de façon atomique.
     */
    async credit(userId: string, amount: number, currency: Currency): Promise<IWallet> {
        await connectDB()
        return Wallet.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(userId) },
            {
                $inc: { balance: amount, totalEarned: amount },
                $set: { lastUpdatedAt: new Date() },
                $setOnInsert: { currency },
            },
            { upsert: true, new: true }
        ) as Promise<IWallet>
    }

    /**
     * Débite le wallet lors d'un virement. Vérifie que le solde est suffisant.
     */
    async debit(userId: string, amount: number): Promise<IWallet> {
        await connectDB()
        const result = await Wallet.findOneAndUpdate(
            {
                userId: new mongoose.Types.ObjectId(userId),
                balance: { $gte: amount },
            },
            {
                $inc: { balance: -amount, totalWithdrawn: amount },
                $set: { lastUpdatedAt: new Date() },
            },
            { new: true }
        ) as IWallet | null

        if (!result) throw new Error('Solde insuffisant ou wallet introuvable')
        return result
    }
}

export const walletRepository = new WalletRepository()
