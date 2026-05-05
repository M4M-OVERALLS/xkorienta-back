import { BookConfigService } from '@/lib/services/BookConfigService'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { StorageProvider, PaymentProvider } from '@/models/enums'

jest.mock('@/lib/repositories/BookConfigRepository')

const mockConfig = {
    commissionRate: 5,
    storageProvider: StorageProvider.LOCAL,
    paymentProvider: PaymentProvider.NOTCHPAY,
    discountRules: [
        { minLevel: 1,  maxLevel: 5,   discountPercent: 0  },
        { minLevel: 6,  maxLevel: 10,  discountPercent: 10 },
        { minLevel: 11, maxLevel: 20,  discountPercent: 20 },
        { minLevel: 21, maxLevel: 999, discountPercent: 30 },
    ],
    maxFileSizeBytes: 50 * 1024 * 1024,
}

const mockRepo = bookConfigRepository as jest.Mocked<typeof bookConfigRepository>

describe('BookConfigService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRepo.getOrCreate.mockResolvedValue(mockConfig as any)
        mockRepo.update.mockResolvedValue(mockConfig as any)
    })

    describe('getConfig', () => {
        it('should return the current config', async () => {
            const config = await BookConfigService.getConfig()
            expect(config.commissionRate).toBe(5)
            expect(config.storageProvider).toBe(StorageProvider.LOCAL)
            expect(mockRepo.getOrCreate).toHaveBeenCalledTimes(1)
        })
    })

    describe('updateConfig', () => {
        it('should update commission rate', async () => {
            await BookConfigService.updateConfig({ commissionRate: 10 })
            expect(mockRepo.update).toHaveBeenCalledWith({ commissionRate: 10 })
        })

        it('should throw when commission rate is negative', async () => {
            await expect(BookConfigService.updateConfig({ commissionRate: -1 }))
                .rejects.toThrow('Commission rate must be between 0 and 100')
        })

        it('should throw when commission rate exceeds 100', async () => {
            await expect(BookConfigService.updateConfig({ commissionRate: 101 }))
                .rejects.toThrow('Commission rate must be between 0 and 100')
        })

        it('should throw when discount rule has minLevel > maxLevel', async () => {
            await expect(BookConfigService.updateConfig({
                discountRules: [{ minLevel: 10, maxLevel: 5, discountPercent: 20 }]
            })).rejects.toThrow('minLevel (10) > maxLevel (5)')
        })

        it('should throw when discountPercent exceeds 100', async () => {
            await expect(BookConfigService.updateConfig({
                discountRules: [{ minLevel: 1, maxLevel: 5, discountPercent: 110 }]
            })).rejects.toThrow('discountPercent must be between 0 and 100')
        })

        it('should throw when discountRules is empty', async () => {
            await expect(BookConfigService.updateConfig({ discountRules: [] }))
                .rejects.toThrow('non-empty array')
        })

        it('should accept valid commission rate of 0 (free platform)', async () => {
            await expect(BookConfigService.updateConfig({ commissionRate: 0 })).resolves.not.toThrow()
        })
    })

    describe('getDiscountForLevel', () => {
        it('should return 0% for level 1-5', async () => {
            expect(await BookConfigService.getDiscountForLevel(1)).toBe(0)
            expect(await BookConfigService.getDiscountForLevel(5)).toBe(0)
        })

        it('should return 10% for level 6-10', async () => {
            expect(await BookConfigService.getDiscountForLevel(6)).toBe(10)
            expect(await BookConfigService.getDiscountForLevel(10)).toBe(10)
        })

        it('should return 20% for level 11-20', async () => {
            expect(await BookConfigService.getDiscountForLevel(15)).toBe(20)
        })

        it('should return 30% for level 21+', async () => {
            expect(await BookConfigService.getDiscountForLevel(50)).toBe(30)
        })

        it('should return 0% when no rule matches', async () => {
            mockRepo.getOrCreate.mockResolvedValue({ ...mockConfig, discountRules: [] } as any)
            expect(await BookConfigService.getDiscountForLevel(1)).toBe(0)
        })
    })

    describe('calculatePricing', () => {
        it('should calculate correct final amount with 10% discount and 5% commission', () => {
            const { finalAmount, teacherAmount, platformCommission } =
                BookConfigService.calculatePricing(10000, 10, 5)

            expect(finalAmount).toBe(9000)          // 10000 - 10%
            expect(platformCommission).toBe(450)     // 9000 * 5%
            expect(teacherAmount).toBe(8550)         // 9000 - 450
        })

        it('should return full price when no discount', () => {
            const { finalAmount } = BookConfigService.calculatePricing(5000, 0, 5)
            expect(finalAmount).toBe(5000)
        })

        it('should handle free books (price = 0)', () => {
            const { finalAmount, teacherAmount, platformCommission } =
                BookConfigService.calculatePricing(0, 0, 5)
            expect(finalAmount).toBe(0)
            expect(teacherAmount).toBe(0)
            expect(platformCommission).toBe(0)
        })

        it('should return 0 commission when rate is 0', () => {
            const { platformCommission, teacherAmount } =
                BookConfigService.calculatePricing(10000, 0, 0)
            expect(platformCommission).toBe(0)
            expect(teacherAmount).toBe(10000)
        })
    })
})
