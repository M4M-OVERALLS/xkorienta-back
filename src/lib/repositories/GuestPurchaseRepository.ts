import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import GuestPurchase, { IGuestPurchase } from '@/models/GuestPurchase'

export class GuestPurchaseRepository {
    async findByReference(reference: string): Promise<IGuestPurchase | null> {
        await connectDB()
        return GuestPurchase.findOne({ paymentReference: reference }).lean() as Promise<IGuestPurchase | null>
    }

    async findByToken(token: string): Promise<IGuestPurchase | null> {
        await connectDB()
        return GuestPurchase.findOne({
            downloadToken: token,
            status: 'COMPLETED',
        }).lean() as Promise<IGuestPurchase | null>
    }

    async findCompletedByEmailAndBook(email: string, bookId: string): Promise<IGuestPurchase | null> {
        await connectDB()
        return GuestPurchase.findOne({
            email: email.toLowerCase(),
            bookId: new mongoose.Types.ObjectId(bookId),
            status: 'COMPLETED',
        }).lean() as Promise<IGuestPurchase | null>
    }

    async create(data: Partial<IGuestPurchase>): Promise<IGuestPurchase> {
        await connectDB()
        return GuestPurchase.create(data)
    }

    async updateStatusByReference(
        reference: string,
        status: 'PENDING' | 'COMPLETED' | 'FAILED'
    ): Promise<void> {
        await connectDB()
        await GuestPurchase.findOneAndUpdate({ paymentReference: reference }, { $set: { status } })
    }

    async setDownloadToken(id: string, token: string, expiry: Date): Promise<void> {
        await connectDB()
        await GuestPurchase.findByIdAndUpdate(id, {
            $set: { downloadToken: token, downloadTokenExpiry: expiry },
        })
    }

    async incrementDownloadCount(id: string): Promise<void> {
        await connectDB()
        await GuestPurchase.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } })
    }

    async updateCommission(
        id: string,
        data: { sellerId: mongoose.Types.ObjectId; sellerAmount: number; platformCommission: number }
    ): Promise<void> {
        await connectDB()
        await GuestPurchase.findByIdAndUpdate(id, { $set: data })
    }
}

export const guestPurchaseRepository = new GuestPurchaseRepository()
