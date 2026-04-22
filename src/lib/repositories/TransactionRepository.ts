import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction, { ITransaction, IStatusHistoryEntry } from '@/models/Transaction'
import { TransactionStatus, TransactionType } from '@/models/enums'

export interface TransactionFilters {
    userId?: string
    type?: TransactionType
    status?: TransactionStatus
    productId?: string
    paymentReference?: string
    fromDate?: Date
    toDate?: Date
    page?: number
    limit?: number
}

export interface PaginatedTransactions {
    transactions: ITransaction[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export interface TransactionStats {
    totalCount: number
    totalAmount: number
    byStatus: Record<string, number>
    byType: Record<string, number>
}

export class TransactionRepository {
    async findById(id: string): Promise<ITransaction | null> {
        await connectDB()
        return Transaction.findById(id)
            .populate('userId', 'name email')
            .populate('sellerId', 'name email')
            .lean() as Promise<ITransaction | null>
    }

    async findByReference(reference: string): Promise<ITransaction | null> {
        await connectDB()
        return Transaction.findOne({ paymentReference: reference })
            .populate('userId', 'name email')
            .lean() as Promise<ITransaction | null>
    }

    async findByUserAndProduct(userId: string, productId: string, type: TransactionType): Promise<ITransaction | null> {
        await connectDB()
        return Transaction.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            productId: new mongoose.Types.ObjectId(productId),
            type,
            status: TransactionStatus.COMPLETED,
        }).lean() as Promise<ITransaction | null>
    }

    async findPaginated(filters: TransactionFilters): Promise<PaginatedTransactions> {
        await connectDB()

        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {}

        if (filters.userId) {
            query.userId = new mongoose.Types.ObjectId(filters.userId)
        }
        if (filters.type) {
            query.type = filters.type
        }
        if (filters.status) {
            query.status = filters.status
        }
        if (filters.productId) {
            query.productId = new mongoose.Types.ObjectId(filters.productId)
        }
        if (filters.paymentReference) {
            query.paymentReference = filters.paymentReference
        }
        if (filters.fromDate || filters.toDate) {
            query.createdAt = {}
            if (filters.fromDate) {
                (query.createdAt as Record<string, Date>).$gte = filters.fromDate
            }
            if (filters.toDate) {
                (query.createdAt as Record<string, Date>).$lte = filters.toDate
            }
        }

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Transaction.countDocuments(query),
        ])

        return {
            transactions: transactions as ITransaction[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    async findByUser(userId: string, page = 1, limit = 20): Promise<PaginatedTransactions> {
        return this.findPaginated({ userId, page, limit })
    }

    async findPendingExpired(): Promise<ITransaction[]> {
        await connectDB()
        return Transaction.find({
            status: TransactionStatus.PENDING,
            expiresAt: { $lt: new Date() },
        }).lean() as Promise<ITransaction[]>
    }

    async create(data: Partial<ITransaction>): Promise<ITransaction> {
        await connectDB()
        const transaction = await Transaction.create(data)
        return transaction
    }

    async updateStatus(
        reference: string,
        status: TransactionStatus,
        reason?: string,
        additionalData?: Partial<ITransaction>
    ): Promise<ITransaction | null> {
        await connectDB()

        const historyEntry: IStatusHistoryEntry = {
            status,
            at: new Date(),
            reason,
        }

        const updateData: Record<string, unknown> = {
            status,
            $push: { statusHistory: historyEntry },
            ...additionalData,
        }

        if (status === TransactionStatus.COMPLETED) {
            updateData.completedAt = new Date()
        }

        return Transaction.findOneAndUpdate(
            { paymentReference: reference },
            updateData,
            { new: true }
        ).lean() as Promise<ITransaction | null>
    }

    async updateById(id: string, data: Partial<ITransaction>): Promise<ITransaction | null> {
        await connectDB()
        return Transaction.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        ).lean() as Promise<ITransaction | null>
    }

    async getStats(filters?: { fromDate?: Date; toDate?: Date; userId?: string }): Promise<TransactionStats> {
        await connectDB()

        const matchStage: Record<string, unknown> = {
            status: TransactionStatus.COMPLETED,
        }

        if (filters?.userId) {
            matchStage.userId = new mongoose.Types.ObjectId(filters.userId)
        }
        if (filters?.fromDate || filters?.toDate) {
            matchStage.createdAt = {}
            if (filters?.fromDate) {
                (matchStage.createdAt as Record<string, Date>).$gte = filters.fromDate
            }
            if (filters?.toDate) {
                (matchStage.createdAt as Record<string, Date>).$lte = filters.toDate
            }
        }

        const [totals, byStatus, byType] = await Promise.all([
            Transaction.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                        totalAmount: { $sum: '$finalAmount' },
                    },
                },
            ]),
            Transaction.aggregate([
                { $match: filters?.userId ? { userId: new mongoose.Types.ObjectId(filters.userId) } : {} },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Transaction.aggregate([
                { $match: matchStage },
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),
        ])

        return {
            totalCount: totals[0]?.totalCount ?? 0,
            totalAmount: totals[0]?.totalAmount ?? 0,
            byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
            byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
        }
    }

    async expireStaleTransactions(olderThanMinutes = 30): Promise<number> {
        await connectDB()
        const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000)

        const result = await Transaction.updateMany(
            {
                status: TransactionStatus.PENDING,
                createdAt: { $lt: cutoff },
            },
            {
                $set: { status: TransactionStatus.EXPIRED },
                $push: {
                    statusHistory: {
                        status: TransactionStatus.EXPIRED,
                        at: new Date(),
                        reason: 'Transaction expired due to timeout',
                    },
                },
            }
        )

        return result.modifiedCount
    }
}

export const transactionRepository = new TransactionRepository()
