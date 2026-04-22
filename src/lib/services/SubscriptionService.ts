import mongoose from 'mongoose'
import { subscriptionRepository } from '@/lib/repositories/SubscriptionRepository'
import { planRepository } from '@/lib/repositories/PlanRepository'
import { transactionRepository } from '@/lib/repositories/TransactionRepository'
import { PaymentService } from './PaymentService'
import { PaymentNotificationService } from './PaymentNotificationService'
import { ISubscription } from '@/models/Subscription'
import { IPlan } from '@/models/Plan'
import {
    SubscriptionPlanStatus,
    SubscriptionInterval,
    TransactionType,
    TransactionStatus,
    Currency,
} from '@/models/enums'

export interface SubscribeParams {
    userId: string
    userEmail: string
    planCode: string
    interval: SubscriptionInterval
    currency: string
    callbackUrl: string
}

export interface SubscriptionResult {
    subscription?: ISubscription
    paymentUrl?: string
    paymentReference?: string
    plan: IPlan
    isFree: boolean
}

export class SubscriptionService {
    /**
     * Calculate subscription period dates.
     */
    private static calculatePeriodDates(
        interval: SubscriptionInterval,
        startDate: Date = new Date()
    ): { start: Date; end: Date } {
        const start = new Date(startDate)
        const end = new Date(start)

        if (interval === SubscriptionInterval.YEARLY) {
            end.setFullYear(end.getFullYear() + 1)
        } else {
            end.setMonth(end.getMonth() + 1)
        }

        return { start, end }
    }

    /**
     * Subscribe a user to a plan.
     */
    static async subscribe(params: SubscribeParams): Promise<SubscriptionResult> {
        const plan = await planRepository.findByCode(params.planCode)
        if (!plan) {
            throw new Error('Plan not found')
        }
        if (!plan.isActive) {
            throw new Error('Plan is not active')
        }

        // Check for existing active subscription
        const existingActive = await subscriptionRepository.findActiveByUser(params.userId)
        if (existingActive) {
            throw new Error('You already have an active subscription. Cancel it first to change plans.')
        }

        // Handle free plan
        if (plan.isFree) {
            const { start, end } = this.calculatePeriodDates(params.interval)

            const subscription = await subscriptionRepository.create({
                userId: new mongoose.Types.ObjectId(params.userId),
                planId: plan._id,
                status: SubscriptionPlanStatus.ACTIVE,
                interval: params.interval,
                currentPeriodStart: start,
                currentPeriodEnd: end,
                currency: params.currency,
                amount: 0,
                autoRenew: true,
            })

            await PaymentNotificationService.notifySubscriptionActivated(
                params.userId,
                subscription,
                plan.name
            )

            return {
                subscription,
                plan,
                isFree: true,
            }
        }

        // Get price for currency and interval
        const price = plan.prices.find(
            (p) => p.currency === params.currency && p.interval === params.interval
        )
        if (!price) {
            throw new Error(`No price found for ${params.currency} ${params.interval}`)
        }

        // Initiate payment
        const paymentResult = await PaymentService.initiatePayment({
            userId: params.userId,
            userEmail: params.userEmail,
            type: TransactionType.SUBSCRIPTION,
            productId: plan._id.toString(),
            productModel: 'Plan',
            paymentCurrency: params.currency,
            callbackUrl: params.callbackUrl,
            interval: params.interval,
            metadata: {
                planCode: plan.code,
                interval: params.interval,
            },
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            paymentReference: paymentResult.reference,
            plan,
            isFree: false,
        }
    }

    /**
     * Activate subscription after successful payment.
     * Called by webhook handler.
     */
    static async activateSubscription(transactionReference: string): Promise<ISubscription> {
        const transaction = await transactionRepository.findByReference(transactionReference)
        if (!transaction) {
            throw new Error('Transaction not found')
        }
        if (transaction.status !== TransactionStatus.COMPLETED) {
            throw new Error('Transaction not completed')
        }
        if (transaction.type !== TransactionType.SUBSCRIPTION) {
            throw new Error('Transaction is not a subscription')
        }

        const plan = await planRepository.findById(transaction.productId.toString())
        if (!plan) {
            throw new Error('Plan not found')
        }

        const interval = (transaction.metadata?.interval as SubscriptionInterval) ?? SubscriptionInterval.MONTHLY
        const { start, end } = this.calculatePeriodDates(interval)

        // Check for existing active subscription and expire it
        const existing = await subscriptionRepository.findActiveByUser(transaction.userId.toString())
        if (existing) {
            await subscriptionRepository.updateStatus(existing._id.toString(), SubscriptionPlanStatus.EXPIRED)
        }

        // Create new subscription
        const subscription = await subscriptionRepository.create({
            userId: transaction.userId,
            planId: transaction.productId,
            status: SubscriptionPlanStatus.ACTIVE,
            interval,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            lastTransactionId: transaction._id,
            currency: transaction.paymentCurrency,
            amount: transaction.finalAmount,
            autoRenew: true,
        })

        await PaymentNotificationService.notifySubscriptionActivated(
            transaction.userId.toString(),
            subscription,
            plan.name
        )

        return subscription
    }

    /**
     * Cancel a subscription.
     */
    static async cancelSubscription(userId: string, subscriptionId?: string): Promise<ISubscription> {
        let subscription: ISubscription | null

        if (subscriptionId) {
            subscription = await subscriptionRepository.findById(subscriptionId)
            if (!subscription || subscription.userId.toString() !== userId) {
                throw new Error('Subscription not found')
            }
        } else {
            subscription = await subscriptionRepository.findActiveByUser(userId)
            if (!subscription) {
                throw new Error('No active subscription found')
            }
        }

        if (subscription.status !== SubscriptionPlanStatus.ACTIVE) {
            throw new Error('Subscription is not active')
        }

        const updated = await subscriptionRepository.updateStatus(
            subscription._id.toString(),
            SubscriptionPlanStatus.CANCELLED
        )

        if (!updated) {
            throw new Error('Failed to cancel subscription')
        }

        return updated
    }

    /**
     * Renew a subscription manually.
     */
    static async renewSubscription(
        userId: string,
        userEmail: string,
        callbackUrl: string
    ): Promise<SubscriptionResult> {
        const subscription = await subscriptionRepository.findActiveByUser(userId)
        if (!subscription) {
            throw new Error('No active subscription found')
        }

        const plan = await planRepository.findById(subscription.planId.toString())
        if (!plan) {
            throw new Error('Plan not found')
        }
        if (!plan.isActive) {
            throw new Error('Plan is no longer active')
        }

        if (plan.isFree) {
            const { start, end } = this.calculatePeriodDates(subscription.interval)
            const renewed = await subscriptionRepository.renewSubscription(
                subscription._id.toString(),
                start,
                end,
                subscription.lastTransactionId?.toString() ?? ''
            )

            return {
                subscription: renewed ?? undefined,
                plan,
                isFree: true,
            }
        }

        // Initiate payment for renewal
        const paymentResult = await PaymentService.initiatePayment({
            userId,
            userEmail,
            type: TransactionType.SUBSCRIPTION,
            productId: plan._id.toString(),
            productModel: 'Plan',
            paymentCurrency: subscription.currency,
            callbackUrl,
            interval: subscription.interval,
            metadata: {
                planCode: plan.code,
                interval: subscription.interval,
                isRenewal: 'true',
                subscriptionId: subscription._id.toString(),
            },
        })

        return {
            paymentUrl: paymentResult.paymentUrl,
            paymentReference: paymentResult.reference,
            plan,
            isFree: false,
        }
    }

    /**
     * Get user's current subscription.
     */
    static async getUserSubscription(userId: string): Promise<{
        subscription: ISubscription | null
        plan: IPlan | null
        isActive: boolean
        daysRemaining: number
    }> {
        const subscription = await subscriptionRepository.findActiveByUser(userId)

        if (!subscription) {
            return {
                subscription: null,
                plan: null,
                isActive: false,
                daysRemaining: 0,
            }
        }

        const plan = await planRepository.findById(subscription.planId.toString())
        const now = new Date()
        const daysRemaining = Math.max(
            0,
            Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        )

        return {
            subscription,
            plan,
            isActive: subscription.status === SubscriptionPlanStatus.ACTIVE && daysRemaining > 0,
            daysRemaining,
        }
    }

    /**
     * Check if user has active subscription.
     */
    static async hasActiveSubscription(userId: string): Promise<boolean> {
        return subscriptionRepository.hasActiveSubscription(userId)
    }

    /**
     * Get user's subscription history.
     */
    static async getUserSubscriptionHistory(userId: string): Promise<ISubscription[]> {
        return subscriptionRepository.findByUser(userId)
    }

    /**
     * Process expired subscriptions.
     */
    static async processExpiredSubscriptions(): Promise<number> {
        const expiredCount = await subscriptionRepository.expireSubscriptions()
        console.log(`[SubscriptionService] Expired ${expiredCount} subscriptions`)
        return expiredCount
    }

    /**
     * Send renewal reminders.
     */
    static async sendRenewalReminders(daysBeforeExpiry = 3): Promise<number> {
        const subscriptions = await subscriptionRepository.findNeedingRenewalReminder(daysBeforeExpiry)
        let sentCount = 0

        for (const sub of subscriptions) {
            try {
                const plan = await planRepository.findById(sub.planId.toString())
                if (!plan) continue

                const daysLeft = Math.ceil(
                    (sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )

                await PaymentNotificationService.notifySubscriptionExpiring(
                    sub.userId.toString(),
                    plan.name,
                    daysLeft,
                    sub.currentPeriodEnd
                )

                await subscriptionRepository.addRenewalReminder(sub._id.toString(), {
                    sentAt: new Date(),
                    type: 'PUSH',
                })

                sentCount++
            } catch (error) {
                console.error(`[SubscriptionService] Failed to send reminder for ${sub._id}:`, error)
            }
        }

        console.log(`[SubscriptionService] Sent ${sentCount} renewal reminders`)
        return sentCount
    }

    /**
     * Get all available plans.
     */
    static async getAvailablePlans(): Promise<IPlan[]> {
        return planRepository.findActive()
    }

    /**
     * Get plan details by code.
     */
    static async getPlanByCode(code: string): Promise<IPlan | null> {
        return planRepository.findByCode(code)
    }
}
