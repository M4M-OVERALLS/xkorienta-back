import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import Subscription, { ISubscription, IRenewalReminder } from '@/models/Subscription'
import { SubscriptionPlanStatus, SubscriptionInterval } from '@/models/enums'

export interface SubscriptionFilters {
    userId?: string
    planId?: string
    status?: SubscriptionPlanStatus
    expiringBefore?: Date
    page?: number
    limit?: number
}

export interface PaginatedSubscriptions {
    subscriptions: ISubscription[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export class SubscriptionRepository {
    async findById(id: string): Promise<ISubscription | null> {
        await connectDB()
        return Subscription.findById(id)
            .populate('userId', 'name email')
            .populate('planId')
            .lean() as Promise<ISubscription | null>
    }

    async findActiveByUser(userId: string): Promise<ISubscription | null> {
        await connectDB()
        return Subscription.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            status: SubscriptionPlanStatus.ACTIVE,
        })
            .populate('planId')
            .lean() as Promise<ISubscription | null>
    }

    async findByUser(userId: string): Promise<ISubscription[]> {
        await connectDB()
        return Subscription.find({
            userId: new mongoose.Types.ObjectId(userId),
        })
            .populate('planId')
            .sort({ createdAt: -1 })
            .lean() as Promise<ISubscription[]>
    }

    async findPaginated(filters: SubscriptionFilters): Promise<PaginatedSubscriptions> {
        await connectDB()

        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
        const skip = (page - 1) * limit

        const query: Record<string, unknown> = {}

        if (filters.userId) {
            query.userId = new mongoose.Types.ObjectId(filters.userId)
        }
        if (filters.planId) {
            query.planId = new mongoose.Types.ObjectId(filters.planId)
        }
        if (filters.status) {
            query.status = filters.status
        }
        if (filters.expiringBefore) {
            query.currentPeriodEnd = { $lt: filters.expiringBefore }
            query.status = SubscriptionPlanStatus.ACTIVE
        }

        const [subscriptions, total] = await Promise.all([
            Subscription.find(query)
                .populate('userId', 'name email')
                .populate('planId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Subscription.countDocuments(query),
        ])

        return {
            subscriptions: subscriptions as ISubscription[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    async findExpiring(beforeDate: Date): Promise<ISubscription[]> {
        await connectDB()
        return Subscription.find({
            status: SubscriptionPlanStatus.ACTIVE,
            currentPeriodEnd: { $lt: beforeDate },
        })
            .populate('userId', 'name email')
            .populate('planId')
            .lean() as Promise<ISubscription[]>
    }

    async findNeedingRenewalReminder(daysBeforeExpiry: number): Promise<ISubscription[]> {
        await connectDB()
        const reminderDate = new Date()
        reminderDate.setDate(reminderDate.getDate() + daysBeforeExpiry)

        return Subscription.find({
            status: SubscriptionPlanStatus.ACTIVE,
            autoRenew: true,
            currentPeriodEnd: {
                $gt: new Date(),
                $lte: reminderDate,
            },
        })
            .populate('userId', 'name email')
            .populate('planId')
            .lean() as Promise<ISubscription[]>
    }

    async create(data: Partial<ISubscription>): Promise<ISubscription> {
        await connectDB()
        const subscription = await Subscription.create(data)
        return subscription
    }

    async updateById(id: string, data: Partial<ISubscription>): Promise<ISubscription | null> {
        await connectDB()
        return Subscription.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        )
            .populate('planId')
            .lean() as Promise<ISubscription | null>
    }

    async updateStatus(id: string, status: SubscriptionPlanStatus): Promise<ISubscription | null> {
        await connectDB()
        const updateData: Record<string, unknown> = { status }

        if (status === SubscriptionPlanStatus.CANCELLED) {
            updateData.cancelledAt = new Date()
        }

        return Subscription.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        )
            .populate('planId')
            .lean() as Promise<ISubscription | null>
    }

    async renewSubscription(
        id: string,
        newPeriodStart: Date,
        newPeriodEnd: Date,
        transactionId: string
    ): Promise<ISubscription | null> {
        await connectDB()
        return Subscription.findByIdAndUpdate(
            id,
            {
                $set: {
                    currentPeriodStart: newPeriodStart,
                    currentPeriodEnd: newPeriodEnd,
                    lastTransactionId: new mongoose.Types.ObjectId(transactionId),
                    status: SubscriptionPlanStatus.ACTIVE,
                },
                $unset: { cancelledAt: 1 },
            },
            { new: true }
        )
            .populate('planId')
            .lean() as Promise<ISubscription | null>
    }

    async addRenewalReminder(id: string, reminder: IRenewalReminder): Promise<void> {
        await connectDB()
        await Subscription.findByIdAndUpdate(id, {
            $push: { renewalReminders: reminder },
        })
    }

    async expireSubscriptions(): Promise<number> {
        await connectDB()
        const result = await Subscription.updateMany(
            {
                status: SubscriptionPlanStatus.ACTIVE,
                currentPeriodEnd: { $lt: new Date() },
            },
            {
                $set: { status: SubscriptionPlanStatus.EXPIRED },
            }
        )
        return result.modifiedCount
    }

    async hasActiveSubscription(userId: string): Promise<boolean> {
        await connectDB()
        const count = await Subscription.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            status: SubscriptionPlanStatus.ACTIVE,
            currentPeriodEnd: { $gt: new Date() },
        })
        return count > 0
    }
}

export const subscriptionRepository = new SubscriptionRepository()
