import { randomUUID } from 'crypto'
import mongoose from 'mongoose'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { bookRepository } from '@/lib/repositories/BookRepository'
import { bookPurchaseRepository } from '@/lib/repositories/BookPurchaseRepository'
import { planRepository } from '@/lib/repositories/PlanRepository'
import { PaymentStrategyFactory } from '@/lib/strategies/payment/PaymentStrategyFactory'
import { CurrencyService } from './CurrencyService'
import { PaymentNotificationService } from './PaymentNotificationService'
import { ITransaction } from '@/models/Transaction'
import {
    TransactionType,
    TransactionStatus,
    PaymentProvider,
    BookStatus,
    SubscriptionInterval,
    BookPurchaseStatus,
} from '@/models/enums'

const DEFAULT_COMMISSION_RATE = parseFloat(process.env.PAYMENT_DEFAULT_COMMISSION_RATE ?? '5')
const TRANSACTION_TTL_MINUTES = parseInt(process.env.PAYMENT_TRANSACTION_TTL_MINUTES ?? '30', 10)

export interface InitiatePaymentParams {
    userId: string
    userEmail: string
    type: TransactionType
    productId: string
    productModel: 'Book' | 'Plan' | 'Course'
    paymentCurrency: string
    callbackUrl: string
    discountPercent?: number
    sellerId?: string
    metadata?: Record<string, unknown>
    interval?: SubscriptionInterval
}

export interface PaymentResult {
    paymentUrl: string
    reference: string
    provider: string
    originalAmount: number
    originalCurrency: string
    convertedAmount: number
    paymentCurrency: string
    exchangeRate: number
    discountPercent: number
    finalAmount: number
}

export class PaymentService {
    /**
     * Generate a unique payment reference.
     */
    private static generateReference(type: TransactionType, productId: string): string {
        const prefix = type.substring(0, 4).toUpperCase()
        const productSuffix = productId.slice(-6).toUpperCase()
        const uuid = randomUUID().slice(0, 8).toUpperCase()
        return `${prefix}-${productSuffix}-${uuid}`
    }

    /**
     * Get product details for payment.
     */
    private static async getProductDetails(
        type: TransactionType,
        productId: string,
        paymentCurrency: string,
        interval?: SubscriptionInterval
    ): Promise<{
        amount: number
        currency: string
        description: string
        sellerId?: string
    }> {
        switch (type) {
            case TransactionType.BOOK_PURCHASE: {
                const book = await bookRepository.findById(productId)
                if (!book) throw new Error('Book not found')
                if (book.status !== BookStatus.APPROVED) throw new Error('Book is not available for purchase')
                if (book.price === 0) throw new Error('This book is free, no purchase needed')

                // Handle both populated and non-populated submittedBy
                let submittedBy: string | undefined
                const submittedById = book.submittedBy as unknown
                if (submittedById) {
                    if (typeof submittedById === 'object' && '_id' in (submittedById as object)) {
                        submittedBy = String((submittedById as { _id: unknown })._id)
                    } else {
                        submittedBy = String(submittedById)
                    }
                }

                return {
                    amount: book.price,
                    currency: book.currency,
                    description: `Achat livre: ${book.title}`,
                    sellerId: submittedBy,
                }
            }

            case TransactionType.SUBSCRIPTION: {
                const plan = await planRepository.findById(productId)
                if (!plan) throw new Error('Plan not found')
                if (!plan.isActive) throw new Error('Plan is not active')
                if (plan.isFree) throw new Error('This plan is free, no payment needed')

                const subscriptionInterval = interval ?? SubscriptionInterval.MONTHLY
                const price = plan.prices.find(
                    (p) => p.currency === paymentCurrency && p.interval === subscriptionInterval
                ) ?? plan.prices.find((p) => p.interval === subscriptionInterval)

                if (!price) throw new Error(`No price found for currency ${paymentCurrency}`)

                return {
                    amount: price.amount,
                    currency: price.currency,
                    description: `Abonnement ${plan.name} (${subscriptionInterval.toLowerCase()})`,
                }
            }

            case TransactionType.COURSE:
                throw new Error('Course payments not yet implemented')

            case TransactionType.TOP_UP:
                throw new Error('Top-up payments not yet implemented')

            default:
                throw new Error(`Unknown transaction type: ${type}`)
        }
    }

    /**
     * Initiate a payment for any product type.
     */
    static async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResult> {
        // Get product details
        const product = await this.getProductDetails(
            params.type,
            params.productId,
            params.paymentCurrency,
            params.interval
        )

        // Check for existing completed transaction
        const existing = await transactionRepository.findByUserAndProduct(
            params.userId,
            params.productId,
            params.type
        )
        if (existing) {
            throw new Error('You have already purchased this item')
        }

        // Convert currency if needed
        const conversion = await CurrencyService.convert(
            product.amount,
            product.currency,
            params.paymentCurrency
        )

        // Apply discount
        const discountPercent = params.discountPercent ?? 0
        const discountedAmount = conversion.convertedAmount * (1 - discountPercent / 100)
        const finalAmount = Math.round(discountedAmount)

        // Calculate commission
        const platformCommission = Math.round(finalAmount * (DEFAULT_COMMISSION_RATE / 100))
        const sellerAmount = finalAmount - platformCommission

        // Generate reference
        const reference = this.generateReference(params.type, params.productId)

        // Calculate expiry
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + TRANSACTION_TTL_MINUTES)

        // Get payment provider (default to NotchPay)
        const providerName = process.env.DEFAULT_PAYMENT_PROVIDER ?? PaymentProvider.NOTCHPAY
        const paymentStrategy = PaymentStrategyFactory.create(providerName)

        // Initialize payment with provider
        const paymentResult = await paymentStrategy.initiatePayment({
            amount: finalAmount,
            currency: params.paymentCurrency,
            reference,
            email: params.userEmail,
            description: product.description,
            callbackUrl: params.callbackUrl,
            metadata: {
                userId: params.userId,
                productId: params.productId,
                type: params.type,
                ...params.metadata,
            },
        })

        // Create transaction record
        await transactionRepository.create({
            userId: new mongoose.Types.ObjectId(params.userId),
            type: params.type,
            productId: new mongoose.Types.ObjectId(params.productId),
            productModel: params.productModel,
            originalAmount: product.amount,
            originalCurrency: product.currency,
            convertedAmount: conversion.convertedAmount,
            paymentCurrency: params.paymentCurrency,
            exchangeRate: conversion.exchangeRate,
            discountPercent,
            finalAmount,
            platformCommission,
            sellerAmount,
            sellerId: params.sellerId
                ? new mongoose.Types.ObjectId(params.sellerId)
                : product.sellerId
                    ? new mongoose.Types.ObjectId(product.sellerId)
                    : undefined,
            paymentReference: reference,
            paymentProvider: providerName,
            status: TransactionStatus.PENDING,
            metadata: params.metadata ?? {},
            expiresAt,
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            reference,
            provider: providerName,
            originalAmount: product.amount,
            originalCurrency: product.currency,
            convertedAmount: conversion.convertedAmount,
            paymentCurrency: params.paymentCurrency,
            exchangeRate: conversion.exchangeRate,
            discountPercent,
            finalAmount,
        }
    }

    /**
     * Handle payment webhook from provider.
     */
    static async handleWebhook(
        provider: string,
        rawPayload: unknown,
        signature: string
    ): Promise<void> {
        const paymentStrategy = PaymentStrategyFactory.create(provider)
        const event = await paymentStrategy.handleWebhook(rawPayload, signature)

        const transaction = await transactionRepository.findByReference(event.reference)
        if (!transaction) {
            console.warn(`[PaymentService] Unknown reference: ${event.reference}`)
            return
        }

        // Skip if already processed
        if (transaction.status === TransactionStatus.COMPLETED) {
            return
        }

        // Map provider status to our status
        const newStatus = this.mapProviderStatus(event.status)

        // Update transaction
        await transactionRepository.updateStatus(
            event.reference,
            newStatus,
            undefined,
            { webhookReceivedAt: new Date() }
        )

        // Handle completion
        if (newStatus === TransactionStatus.COMPLETED) {
            await this.handlePaymentCompleted(transaction)
        }

        // Notify user
        const updatedTransaction = await transactionRepository.findByReference(event.reference)
        if (updatedTransaction) {
            await PaymentNotificationService.notifyPaymentStatus(updatedTransaction)
        }
    }

    /**
     * Handle successful payment completion.
     */
    private static async handlePaymentCompleted(transaction: ITransaction): Promise<void> {
        switch (transaction.type) {
            case TransactionType.BOOK_PURCHASE:
                await bookRepository.incrementPurchaseCount(transaction.productId.toString())
                await bookPurchaseRepository.updateStatusByReference(
                    transaction.paymentReference,
                    BookPurchaseStatus.COMPLETED
                )
                break

            case TransactionType.SUBSCRIPTION:
                // Subscription activation is handled by SubscriptionService
                break

            default:
                break
        }
    }

    /**
     * Map provider status to our TransactionStatus.
     */
    private static mapProviderStatus(
        status: 'completed' | 'pending' | 'failed' | 'cancelled'
    ): TransactionStatus {
        switch (status) {
            case 'completed':
                return TransactionStatus.COMPLETED
            case 'failed':
                return TransactionStatus.FAILED
            case 'cancelled':
                return TransactionStatus.FAILED
            case 'pending':
            default:
                return TransactionStatus.PROCESSING
        }
    }

    /**
     * Get transaction by reference.
     */
    static async getTransactionByReference(reference: string): Promise<ITransaction | null> {
        return transactionRepository.findByReference(reference)
    }

    /**
     * Get transaction status.
     */
    static async getTransactionStatus(reference: string): Promise<{
        reference: string
        status: TransactionStatus
        type: TransactionType
        finalAmount: number
        currency: string
        createdAt: Date
    } | null> {
        const transaction = await transactionRepository.findByReference(reference)
        if (!transaction) return null

        return {
            reference: transaction.paymentReference,
            status: transaction.status,
            type: transaction.type,
            finalAmount: transaction.finalAmount,
            currency: transaction.paymentCurrency,
            createdAt: transaction.createdAt,
        }
    }

    /**
     * Get user transaction history.
     */
    static async getUserTransactions(
        userId: string,
        page = 1,
        limit = 20
    ) {
        return transactionRepository.findByUser(userId, page, limit)
    }

    /**
     * Verify a payment with the provider.
     */
    static async verifyPayment(reference: string): Promise<TransactionStatus> {
        const transaction = await transactionRepository.findByReference(reference)
        if (!transaction) {
            throw new Error('Transaction not found')
        }

        const paymentStrategy = PaymentStrategyFactory.create(transaction.paymentProvider)
        const result = await paymentStrategy.verifyPayment(reference)
        const newStatus = this.mapProviderStatus(result.status)

        // Update if status changed
        if (transaction.status !== newStatus) {
            await transactionRepository.updateStatus(reference, newStatus)

            if (newStatus === TransactionStatus.COMPLETED) {
                await this.handlePaymentCompleted(transaction)
            }
        }

        return newStatus
    }

    /**
     * Expire stale pending transactions.
     */
    static async expireStaleTransactions(): Promise<number> {
        return transactionRepository.expireStaleTransactions(TRANSACTION_TTL_MINUTES)
    }

    /**
     * Get transaction statistics.
     */
    static async getStats(filters?: { fromDate?: Date; toDate?: Date; userId?: string }) {
        return transactionRepository.getStats(filters)
    }
}
