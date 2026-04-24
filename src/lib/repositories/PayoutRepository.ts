import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Payout, { IPayout } from '@/models/Payout'
import { PayoutStatus } from '@/models/enums'

export class PayoutRepository {
    async create(data: Partial<IPayout>): Promise<IPayout> {
        await connectDB()
        return Payout.create(data)
    }

    async findByReference(payoutReference: string): Promise<IPayout | null> {
        await connectDB()
        return Payout.findOne({ payoutReference }).lean() as Promise<IPayout | null>
    }

    async findByUser(userId: string, page = 1, limit = 20): Promise<IPayout[]> {
        await connectDB()
        const skip = (page - 1) * limit
        return Payout.find({ userId: new mongoose.Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean() as Promise<IPayout[]>
    }

    async updateStatus(
        payoutReference: string,
        status: PayoutStatus,
        providerTransferId?: string,
        failureReason?: string
    ): Promise<void> {
        await connectDB()
        const update: Record<string, unknown> = { status }
        if (status === PayoutStatus.COMPLETED) update.processedAt = new Date()
        if (providerTransferId) update.providerTransferId = providerTransferId
        if (failureReason) update.failureReason = failureReason
        await Payout.updateOne({ payoutReference }, { $set: update })
    }

    async findPending(): Promise<IPayout[]> {
        await connectDB()
        return Payout.find({ status: PayoutStatus.PENDING })
            .sort({ createdAt: 1 })
            .lean() as Promise<IPayout[]>
    }
}

export const payoutRepository = new PayoutRepository()
