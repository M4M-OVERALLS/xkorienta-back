import connectDB from '@/lib/mongodb'
import ExchangeRate, { IExchangeRate } from '@/models/ExchangeRate'
import { Currency } from '@/models/enums'

export interface ExchangeRateData {
    baseCurrency: Currency
    targetCurrency: Currency
    rate: number
    inverseRate: number
    source: string
    expiresAt: Date
}

export class ExchangeRateRepository {
    async findByPair(baseCurrency: string, targetCurrency: string): Promise<IExchangeRate | null> {
        await connectDB()
        return ExchangeRate.findOne({
            baseCurrency: baseCurrency.toUpperCase(),
            targetCurrency: targetCurrency.toUpperCase(),
        }).lean() as Promise<IExchangeRate | null>
    }

    async findValidByPair(baseCurrency: string, targetCurrency: string): Promise<IExchangeRate | null> {
        await connectDB()
        return ExchangeRate.findOne({
            baseCurrency: baseCurrency.toUpperCase(),
            targetCurrency: targetCurrency.toUpperCase(),
            expiresAt: { $gt: new Date() },
        }).lean() as Promise<IExchangeRate | null>
    }

    async findAllForBase(baseCurrency: string): Promise<IExchangeRate[]> {
        await connectDB()
        return ExchangeRate.find({
            baseCurrency: baseCurrency.toUpperCase(),
        }).lean() as Promise<IExchangeRate[]>
    }

    async findAllValid(): Promise<IExchangeRate[]> {
        await connectDB()
        return ExchangeRate.find({
            expiresAt: { $gt: new Date() },
        }).lean() as Promise<IExchangeRate[]>
    }

    async upsert(data: ExchangeRateData): Promise<IExchangeRate> {
        await connectDB()
        const result = await ExchangeRate.findOneAndUpdate(
            {
                baseCurrency: data.baseCurrency.toUpperCase(),
                targetCurrency: data.targetCurrency.toUpperCase(),
            },
            {
                $set: {
                    rate: data.rate,
                    inverseRate: data.inverseRate,
                    source: data.source,
                    fetchedAt: new Date(),
                    expiresAt: data.expiresAt,
                },
            },
            { new: true, upsert: true }
        )
        return result
    }

    async upsertMany(rates: ExchangeRateData[]): Promise<void> {
        await connectDB()
        const bulkOps = rates.map((data) => ({
            updateOne: {
                filter: {
                    baseCurrency: data.baseCurrency.toUpperCase(),
                    targetCurrency: data.targetCurrency.toUpperCase(),
                },
                update: {
                    $set: {
                        rate: data.rate,
                        inverseRate: data.inverseRate,
                        source: data.source,
                        fetchedAt: new Date(),
                        expiresAt: data.expiresAt,
                    },
                },
                upsert: true,
            },
        }))

        await ExchangeRate.bulkWrite(bulkOps)
    }

    async deleteExpired(): Promise<number> {
        await connectDB()
        const result = await ExchangeRate.deleteMany({
            expiresAt: { $lt: new Date() },
        })
        return result.deletedCount
    }

    async deleteAll(): Promise<void> {
        await connectDB()
        await ExchangeRate.deleteMany({})
    }
}

export const exchangeRateRepository = new ExchangeRateRepository()
