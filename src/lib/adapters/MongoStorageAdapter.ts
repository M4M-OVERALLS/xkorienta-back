import type {
    IStorageAdapter,
    TransactionData,
    TransactionStatus,
    IdempotencyRecord,
} from '@xkorienta/payment-sdk'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { TransactionStatus as DbStatus } from '@/models/enums'
import Idempotency from '@/models/Idempotency'
import { exchangeRateRepository } from '@/lib/repositories/ExchangeRateRepository'

/**
 * Wraps the existing Mongoose Transaction and ExchangeRate collections
 * to satisfy the payment-SDK IStorageAdapter port.
 */
export class MongoStorageAdapter implements IStorageAdapter {

    // ─── Transactions ────────────────────────────────────────────────────────

    async createTransaction(
        data: Omit<TransactionData, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<TransactionData> {
        await connectDB()
        const doc = await Transaction.create({
            userId: data.userId,
            type: data.type,
            productId: data.productId,
            productModel: data.productType,
            originalAmount: data.originalAmount,
            originalCurrency: data.originalCurrency,
            convertedAmount: data.convertedAmount,
            paymentCurrency: data.paymentCurrency,
            exchangeRate: data.exchangeRate,
            discountPercent: data.discountPercent,
            finalAmount: data.finalAmount,
            platformCommission: data.platformCommission,
            sellerAmount: data.sellerAmount,
            sellerId: data.sellerId,
            paymentReference: data.paymentReference,
            paymentProvider: data.paymentProvider,
            providerTransactionId: data.providerTransactionId,
            status: data.status,
            statusHistory: data.statusHistory,
            metadata: data.metadata,
            webhookReceivedAt: data.webhookReceivedAt,
            completedAt: data.completedAt,
            expiresAt: data.expiresAt,
        })
        return this.toTransactionData(doc.toObject())
    }

    async findTransactionByReference(reference: string): Promise<TransactionData | null> {
        await connectDB()
        const doc = await Transaction.findOne({ paymentReference: reference }).lean()
        return doc ? this.toTransactionData(doc) : null
    }

    async findTransactionsByUser(
        userId: string,
        page: number,
        limit: number
    ): Promise<{ transactions: TransactionData[]; total: number; page: number; totalPages: number }> {
        await connectDB()
        const skip = (page - 1) * limit
        const [docs, total] = await Promise.all([
            Transaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Transaction.countDocuments({ userId }),
        ])
        return {
            transactions: docs.map((d) => this.toTransactionData(d)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        }
    }

    async updateTransactionStatus(
        reference: string,
        status: TransactionStatus,
        extra?: Partial<Pick<TransactionData, 'webhookReceivedAt' | 'completedAt' | 'providerTransactionId' | 'metadata'>>
    ): Promise<TransactionData> {
        await connectDB()
        const doc = await Transaction.findOneAndUpdate(
            { paymentReference: reference },
            {
                $set: { status, ...extra },
                $push: { statusHistory: { status, at: new Date() } },
            },
            { new: true }
        ).lean()
        if (!doc) throw new Error(`Transaction not found: ${reference}`)
        return this.toTransactionData(doc)
    }

    async findDuplicateTransaction(
        userId: string,
        productId: string,
        type: string
    ): Promise<TransactionData | null> {
        await connectDB()
        const doc = await Transaction.findOne({
            userId,
            productId,
            type,
            status: DbStatus.COMPLETED,
        }).lean()
        return doc ? this.toTransactionData(doc) : null
    }

    async expireStaleTransactions(ttlMinutes: number): Promise<number> {
        await connectDB()
        const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000)
        const result = await Transaction.updateMany(
            { status: DbStatus.PENDING, createdAt: { $lt: cutoff } },
            {
                $set: { status: DbStatus.EXPIRED },
                $push: { statusHistory: { status: DbStatus.EXPIRED, at: new Date() } },
            }
        )
        return result.modifiedCount
    }

    // ─── Exchange rate cache ──────────────────────────────────────────────────

    async getCachedRate(from: string, to: string): Promise<{ rate: number } | null> {
        const row = await exchangeRateRepository.findValidByPair(from, to)
        return row ? { rate: row.rate } : null
    }

    async setCachedRate(from: string, to: string, rate: number, expiresAt: Date): Promise<void> {
        const Currency = (await import('@/models/enums')).Currency
        await exchangeRateRepository.upsert({
            baseCurrency: from as typeof Currency[keyof typeof Currency],
            targetCurrency: to as typeof Currency[keyof typeof Currency],
            rate,
            inverseRate: rate > 0 ? 1 / rate : 0,
            source: 'sdk-cache',
            expiresAt,
        })
    }

    // ─── Idempotency ─────────────────────────────────────────────────────────

    async acquireIdempotencyLock(
        record: Omit<IdempotencyRecord, 'responsePayload' | 'errorPayload'>
    ): Promise<{ created: boolean; record: IdempotencyRecord }> {
        await connectDB()
        const existing = await Idempotency.findOne({ key: record.key }).lean()
        if (existing) {
            return { created: false, record: existing as unknown as IdempotencyRecord }
        }
        const created = await Idempotency.findOneAndUpdate(
            { key: record.key },
            { $setOnInsert: record },
            { upsert: true, new: true }
        ).lean()
        return { created: true, record: created as unknown as IdempotencyRecord }
    }

    async completeIdempotencyRecord(
        key: string,
        responsePayload: Record<string, unknown>
    ): Promise<void> {
        await connectDB()
        await Idempotency.updateOne({ key }, { $set: { status: 'COMPLETED', responsePayload } })
    }

    async failIdempotencyRecord(
        key: string,
        error: { code: string; message: string }
    ): Promise<void> {
        await connectDB()
        await Idempotency.updateOne({ key }, { $set: { status: 'FAILED', errorPayload: error } })
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private toTransactionData(doc: Record<string, unknown>): TransactionData {
        return {
            id: String((doc._id as object)?.toString?.() ?? doc._id),
            userId: String(doc.userId),
            type: doc.type as string,
            productId: String(doc.productId),
            productType: doc.productModel as string,
            originalAmount: doc.originalAmount as number,
            originalCurrency: doc.originalCurrency as string,
            convertedAmount: doc.convertedAmount as number,
            paymentCurrency: doc.paymentCurrency as string,
            exchangeRate: doc.exchangeRate as number,
            discountPercent: doc.discountPercent as number,
            finalAmount: doc.finalAmount as number,
            platformCommission: doc.platformCommission as number,
            sellerAmount: doc.sellerAmount as number,
            sellerId: doc.sellerId ? String(doc.sellerId) : undefined,
            paymentReference: doc.paymentReference as string,
            paymentProvider: doc.paymentProvider as string,
            providerTransactionId: doc.providerTransactionId as string | undefined,
            status: doc.status as TransactionStatus,
            statusHistory: (doc.statusHistory as Array<{ status: TransactionStatus; at: Date; reason?: string }>) ?? [],
            metadata: (doc.metadata as Record<string, unknown>) ?? {},
            webhookReceivedAt: doc.webhookReceivedAt as Date | undefined,
            completedAt: doc.completedAt as Date | undefined,
            expiresAt: doc.expiresAt as Date,
            createdAt: doc.createdAt as Date,
            updatedAt: doc.updatedAt as Date,
        }
    }
}
