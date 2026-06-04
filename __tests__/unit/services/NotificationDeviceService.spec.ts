/**
 * Tests Unitaires — NotificationDeviceService
 *
 * Couvre : registerDevice (upsert), unregisterDevice
 * MongoDB : MongoMemoryServer (isolation complète)
 */

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { NotificationDeviceService } from '@/lib/services/NotificationDeviceService'
import NotificationDevice from '@/models/NotificationDevice'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
})

beforeEach(async () => {
    await NotificationDevice.deleteMany({})
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_A = new mongoose.Types.ObjectId().toString()
const USER_B = new mongoose.Types.ObjectId().toString()
const TOKEN_1 = 'fcm_token_device_1_aaaaabbbbcccc'
const TOKEN_2 = 'fcm_token_device_2_ddddeeeefffff'
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ─── registerDevice ──────────────────────────────────────────────────────────

describe('NotificationDeviceService.registerDevice', () => {
    describe('création (token inexistant)', () => {
        it('should create a new device document', async () => {
            await NotificationDeviceService.registerDevice({
                userId: USER_A,
                token: TOKEN_1,
                platform: 'android',
                deviceId: DEVICE_UUID,
            })

            const count = await NotificationDevice.countDocuments()
            expect(count).toBe(1)
        })

        it('should store all fields correctly', async () => {
            await NotificationDeviceService.registerDevice({
                userId: USER_A,
                token: TOKEN_1,
                platform: 'ios',
                deviceId: DEVICE_UUID,
            })

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc).not.toBeNull()
            expect(doc!.userId.toString()).toBe(USER_A)
            expect(doc!.platform).toBe('ios')
            expect(doc!.deviceId).toBe(DEVICE_UUID)
            expect(doc!.lastUsedAt).toBeInstanceOf(Date)
        })

        it('should allow a user to register multiple devices', async () => {
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_2, platform: 'android' })

            const count = await NotificationDevice.countDocuments({ userId: USER_A })
            expect(count).toBe(2)
        })

        it('should work without deviceId (optional field)', async () => {
            await NotificationDeviceService.registerDevice({
                userId: USER_A,
                token: TOKEN_1,
                platform: 'web',
            })

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc).not.toBeNull()
            expect(doc!.deviceId).toBeUndefined()
        })
    })

    describe('upsert (token existant)', () => {
        it('should not create a duplicate when called twice with same token', async () => {
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })

            const count = await NotificationDevice.countDocuments({ token: TOKEN_1 })
            expect(count).toBe(1)
        })

        it('should update updatedAt and lastUsedAt on second call', async () => {
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            const first = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()

            // Pause pour que les timestamps diffèrent
            await new Promise(r => setTimeout(r, 10))

            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            const second = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()

            expect(second!.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(first!.lastUsedAt!.getTime())
        })

        it('should reassign userId when a different user registers the same token (shared device)', async () => {
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            await NotificationDeviceService.registerDevice({ userId: USER_B, token: TOKEN_1, platform: 'android' })

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc!.userId.toString()).toBe(USER_B)
            expect(await NotificationDevice.countDocuments()).toBe(1)
        })

        it('should update platform on upsert', async () => {
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'android' })
            await NotificationDeviceService.registerDevice({ userId: USER_A, token: TOKEN_1, platform: 'ios' })

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc!.platform).toBe('ios')
        })
    })
})

// ─── unregisterDevice ────────────────────────────────────────────────────────

describe('NotificationDeviceService.unregisterDevice', () => {
    beforeEach(async () => {
        await NotificationDevice.create({
            userId: new mongoose.Types.ObjectId(USER_A),
            token: TOKEN_1,
            platform: 'android',
            lastUsedAt: new Date(),
        })
    })

    it('should delete the device for the correct user + token', async () => {
        await NotificationDeviceService.unregisterDevice({ userId: USER_A, token: TOKEN_1 })

        const count = await NotificationDevice.countDocuments({ token: TOKEN_1 })
        expect(count).toBe(0)
    })

    it('should NOT delete the device when userId does not match (security)', async () => {
        await NotificationDeviceService.unregisterDevice({ userId: USER_B, token: TOKEN_1 })

        const count = await NotificationDevice.countDocuments({ token: TOKEN_1 })
        expect(count).toBe(1)
    })

    it('should not throw when device does not exist', async () => {
        await expect(
            NotificationDeviceService.unregisterDevice({ userId: USER_A, token: 'unknown_token' })
        ).resolves.not.toThrow()
    })

    it('should only delete the targeted device, not others for the same user', async () => {
        await NotificationDevice.create({
            userId: new mongoose.Types.ObjectId(USER_A),
            token: TOKEN_2,
            platform: 'ios',
            lastUsedAt: new Date(),
        })

        await NotificationDeviceService.unregisterDevice({ userId: USER_A, token: TOKEN_1 })

        const remaining = await NotificationDevice.countDocuments({ userId: USER_A })
        expect(remaining).toBe(1)

        const remainingDoc = await NotificationDevice.findOne({ userId: USER_A }).lean()
        expect(remainingDoc!.token).toBe(TOKEN_2)
    })
})
