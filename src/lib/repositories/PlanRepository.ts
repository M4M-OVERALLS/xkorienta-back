import connectDB from '@/lib/mongodb'
import Plan, { IPlan } from '@/models/Plan'
import { SubscriptionInterval, Currency } from '@/models/enums'

export interface PlanFilters {
    isActive?: boolean
    isFree?: boolean
}

export class PlanRepository {
    async findById(id: string): Promise<IPlan | null> {
        await connectDB()
        return Plan.findById(id).lean() as Promise<IPlan | null>
    }

    async findByCode(code: string): Promise<IPlan | null> {
        await connectDB()
        return Plan.findOne({ code: code.toUpperCase() }).lean() as Promise<IPlan | null>
    }

    async findAll(filters?: PlanFilters): Promise<IPlan[]> {
        await connectDB()

        const query: Record<string, unknown> = {}
        if (filters?.isActive !== undefined) {
            query.isActive = filters.isActive
        }
        if (filters?.isFree !== undefined) {
            query.isFree = filters.isFree
        }

        return Plan.find(query)
            .sort({ sortOrder: 1 })
            .lean() as Promise<IPlan[]>
    }

    async findActive(): Promise<IPlan[]> {
        return this.findAll({ isActive: true })
    }

    async create(data: Partial<IPlan>): Promise<IPlan> {
        await connectDB()
        const plan = await Plan.create(data)
        return plan
    }

    async updateById(id: string, data: Partial<IPlan>): Promise<IPlan | null> {
        await connectDB()
        return Plan.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        ).lean() as Promise<IPlan | null>
    }

    async updateByCode(code: string, data: Partial<IPlan>): Promise<IPlan | null> {
        await connectDB()
        return Plan.findOneAndUpdate(
            { code: code.toUpperCase() },
            { $set: data },
            { new: true }
        ).lean() as Promise<IPlan | null>
    }

    async getPriceForCurrency(
        planCode: string,
        currency: Currency,
        interval: SubscriptionInterval
    ): Promise<number | null> {
        await connectDB()
        const plan = await Plan.findOne({ code: planCode.toUpperCase() }).lean()
        if (!plan) return null

        const price = plan.prices.find(
            (p) => p.currency === currency && p.interval === interval
        )
        return price?.amount ?? null
    }

    async deleteById(id: string): Promise<void> {
        await connectDB()
        await Plan.findByIdAndDelete(id)
    }

    async upsertByCode(code: string, data: Partial<IPlan>): Promise<IPlan> {
        await connectDB()
        const result = await Plan.findOneAndUpdate(
            { code: code.toUpperCase() },
            { $set: { ...data, code: code.toUpperCase() } },
            { new: true, upsert: true }
        )
        return result
    }
}

export const planRepository = new PlanRepository()
