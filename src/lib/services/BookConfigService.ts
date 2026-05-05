import { IBookConfig, IDiscountRule } from '@/models/BookConfig'
import { StorageProvider, PaymentProvider } from '@/models/enums'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'

export interface UpdateConfigInput {
    commissionRate?: number
    storageProvider?: StorageProvider
    paymentProvider?: PaymentProvider
    discountRules?: IDiscountRule[]
    maxFileSizeBytes?: number
}

export class BookConfigService {
    /**
     * Returns the current platform book configuration.
     * Creates it with defaults on first call.
     */
    static async getConfig(): Promise<IBookConfig> {
        return bookConfigRepository.getOrCreate()
    }

    /**
     * Updates the book configuration. Only provided fields are changed.
     * Validates discount rules before saving.
     */
    static async updateConfig(input: UpdateConfigInput): Promise<IBookConfig> {
        if (input.commissionRate !== undefined) {
            if (input.commissionRate < 0 || input.commissionRate > 100) {
                throw new Error('Commission rate must be between 0 and 100')
            }
        }

        if (input.discountRules !== undefined) {
            BookConfigService.validateDiscountRules(input.discountRules)
        }

        if (input.maxFileSizeBytes !== undefined && input.maxFileSizeBytes < 1) {
            throw new Error('maxFileSizeBytes must be a positive number')
        }

        return bookConfigRepository.update(input)
    }

    /**
     * Calculates the discount percent for a given gamification level.
     */
    static async getDiscountForLevel(userLevel: number): Promise<number> {
        const config = await bookConfigRepository.getOrCreate()

        const rule = config.discountRules.find(
            (r) => userLevel >= r.minLevel && userLevel <= r.maxLevel
        )

        return rule?.discountPercent ?? 0
    }

    /**
     * Calculates the final price after discount and commission split.
     */
    static calculatePricing(
        originalPrice: number,
        discountPercent: number,
        commissionRate: number
    ): { finalAmount: number; teacherAmount: number; platformCommission: number } {
        const discountFactor = 1 - discountPercent / 100
        const finalAmount = Math.round(originalPrice * discountFactor)
        const platformCommission = Math.round(finalAmount * (commissionRate / 100))
        const teacherAmount = finalAmount - platformCommission

        return { finalAmount, teacherAmount, platformCommission }
    }

    private static validateDiscountRules(rules: IDiscountRule[]): void {
        if (!Array.isArray(rules) || rules.length === 0) {
            throw new Error('discountRules must be a non-empty array')
        }

        for (const rule of rules) {
            if (rule.minLevel > rule.maxLevel) {
                throw new Error(
                    `Invalid discount rule: minLevel (${rule.minLevel}) > maxLevel (${rule.maxLevel})`
                )
            }
            if (rule.discountPercent < 0 || rule.discountPercent > 100) {
                throw new Error(`discountPercent must be between 0 and 100, got ${rule.discountPercent}`)
            }
        }
    }
}
