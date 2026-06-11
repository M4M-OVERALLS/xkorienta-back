/**
 * Tests d'intégration — POST & DELETE /api/notification-devices
 *
 * Teste les routes HTTP complètes : auth, validation, persistance.
 * Les erreurs sont retournées via le système centralisé (BaseApplicationError.toJSON).
 * MongoDB : MongoMemoryServer — aucune base réelle requise.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
    authOptions: {},
}))

// ─── Imports ─────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import {
    connectMongoMemory,
    disconnectMongoMemory,
} from '../helpers/mongoMemory'
import { POST, DELETE } from '@/app/api/notification-devices/route'
import NotificationDevice from '@/models/NotificationDevice'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

beforeAll(async () => {
    await connectMongoMemory()
}, 30000)

afterAll(async () => {
    await disconnectMongoMemory()
})

beforeEach(async () => {
    await NotificationDevice.deleteMany({})
    jest.clearAllMocks()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toString()
const ANOTHER_USER_ID = new mongoose.Types.ObjectId().toString()
const FCM_TOKEN = 'fcm_token_test_aabbccddeeff112233'

function makeSession(userId = USER_ID): any {
    return { user: { id: userId, email: 'test@test.com' } }
}

function makePostRequest(body: unknown): Request {
    return new Request('http://localhost/api/notification-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function makeDeleteRequest(body: unknown): Request {
    return new Request('http://localhost/api/notification-devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

// ─── POST /api/notification-devices ──────────────────────────────────────────

describe('POST /api/notification-devices', () => {
    describe('authentification', () => {
        it('should return 401 with AUTH_007 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))
            const body = await res.json()

            expect(res.status).toBe(401)
            expect(body.success).toBe(false)
            expect(body.error.code).toBe('AUTH_007')
        })

        it('should return 401 when session has no user id', async () => {
            mockGetServerSession.mockResolvedValue({ user: {} } as any)

            const res = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))

            expect(res.status).toBe(401)
        })
    })

    describe('validation du body', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 400 with NOTIF_001 when token is missing', async () => {
            const res = await POST(makePostRequest({ platform: 'android' }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.success).toBe(false)
            expect(body.error.code).toBe('NOTIF_001')
        })

        it('should return 400 with NOTIF_001 when token is empty string', async () => {
            const res = await POST(makePostRequest({ token: '   ', platform: 'android' }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_001')
        })

        it('should return 400 with NOTIF_002 when platform is missing', async () => {
            const res = await POST(makePostRequest({ token: FCM_TOKEN }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_002')
        })

        it('should return 400 with NOTIF_002 when platform is invalid', async () => {
            const res = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'windows' }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_002')
        })

        it('should include error context with receivedPlatform', async () => {
            const res = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'foobar' }))
            const body = await res.json()

            expect(body.error.context.receivedPlatform).toBe('foobar')
        })
    })

    describe('création et upsert', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 200 and create a device document', async () => {
            const res = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.message).toBe('Device registered')

            const count = await NotificationDevice.countDocuments()
            expect(count).toBe(1)
        })

        it('should return 200 and NOT create a duplicate on second call (idempotent)', async () => {
            await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))
            const res2 = await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))
            const body2 = await res2.json()

            expect(res2.status).toBe(200)
            expect(body2.success).toBe(true)
            expect(await NotificationDevice.countDocuments()).toBe(1)
        })

        it('should accept all valid platforms', async () => {
            for (const platform of ['android', 'ios', 'web']) {
                await NotificationDevice.deleteMany({})
                const res = await POST(makePostRequest({ token: FCM_TOKEN, platform }))
                expect(res.status).toBe(200)
            }
        })

        it('should store deviceId when provided', async () => {
            const deviceId = '550e8400-e29b-41d4-a716-446655440000'
            await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android', deviceId }))

            const doc = await NotificationDevice.findOne({ token: FCM_TOKEN }).lean()
            expect(doc!.deviceId).toBe(deviceId)
        })

        it('should trim whitespace from the token', async () => {
            await POST(makePostRequest({ token: `  ${FCM_TOKEN}  `, platform: 'android' }))

            const doc = await NotificationDevice.findOne({}).lean()
            expect(doc!.token).toBe(FCM_TOKEN)
        })

        it('should update userId when same token is re-registered by a different user', async () => {
            mockGetServerSession.mockResolvedValue(makeSession(USER_ID))
            await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))

            mockGetServerSession.mockResolvedValue(makeSession(ANOTHER_USER_ID))
            await POST(makePostRequest({ token: FCM_TOKEN, platform: 'android' }))

            expect(await NotificationDevice.countDocuments()).toBe(1)
            const doc = await NotificationDevice.findOne({}).lean()
            expect(doc!.userId.toString()).toBe(ANOTHER_USER_ID)
        })

        it('should allow one user to register multiple devices', async () => {
            await POST(makePostRequest({ token: 'token_device_A', platform: 'android' }))
            await POST(makePostRequest({ token: 'token_device_B', platform: 'ios' }))

            expect(await NotificationDevice.countDocuments({ userId: USER_ID })).toBe(2)
        })
    })
})

// ─── DELETE /api/notification-devices ────────────────────────────────────────

describe('DELETE /api/notification-devices', () => {
    describe('authentification', () => {
        it('should return 401 with AUTH_007 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await DELETE(makeDeleteRequest({ token: FCM_TOKEN }))
            const body = await res.json()

            expect(res.status).toBe(401)
            expect(body.error.code).toBe('AUTH_007')
        })
    })

    describe('validation du body', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 400 with NOTIF_001 when token is missing', async () => {
            const res = await DELETE(makeDeleteRequest({}))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_001')
        })

        it('should return 400 with NOTIF_001 when token is empty', async () => {
            const res = await DELETE(makeDeleteRequest({ token: '' }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_001')
        })
    })

    describe('suppression du device', () => {
        beforeEach(async () => {
            mockGetServerSession.mockResolvedValue(makeSession())
            await NotificationDevice.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                token: FCM_TOKEN,
                platform: 'android',
                lastUsedAt: new Date(),
            })
        })

        it('should return 200 and delete the device', async () => {
            const res = await DELETE(makeDeleteRequest({ token: FCM_TOKEN }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.message).toBe('Device removed')
            expect(await NotificationDevice.countDocuments()).toBe(0)
        })

        it('should NOT delete a device belonging to a different user (security)', async () => {
            mockGetServerSession.mockResolvedValue(makeSession(ANOTHER_USER_ID))

            const res = await DELETE(makeDeleteRequest({ token: FCM_TOKEN }))

            expect(res.status).toBe(200) // pas d'erreur — aucune suppression silencieuse
            expect(await NotificationDevice.countDocuments()).toBe(1)
        })

        it('should return 200 even if the device does not exist (idempotent)', async () => {
            const res = await DELETE(makeDeleteRequest({ token: 'non_existent_token' }))
            expect(res.status).toBe(200)
        })

        it('should only delete the targeted device, leaving others intact', async () => {
            await NotificationDevice.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                token: 'keep_me_token',
                platform: 'ios',
                lastUsedAt: new Date(),
            })

            await DELETE(makeDeleteRequest({ token: FCM_TOKEN }))

            expect(await NotificationDevice.countDocuments({ userId: USER_ID })).toBe(1)
            const kept = await NotificationDevice.findOne({ userId: USER_ID }).lean()
            expect(kept!.token).toBe('keep_me_token')
        })
    })
})
