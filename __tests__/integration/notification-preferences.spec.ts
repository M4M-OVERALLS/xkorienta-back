/**
 * Tests d'intégration — GET & PATCH /api/notification-preferences
 *
 * Teste les routes HTTP complètes : auth, lazy init, merge profond, validation.
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
import { GET, PATCH } from '@/app/api/notification-preferences/route'
import NotificationPreferences from '@/models/NotificationPreferences'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

beforeAll(async () => {
    await connectMongoMemory()
}, 30000)

afterAll(async () => {
    await disconnectMongoMemory()
})

beforeEach(async () => {
    await NotificationPreferences.deleteMany({})
    jest.clearAllMocks()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toString()

function makeSession(userId = USER_ID): any {
    return { user: { id: userId, email: 'test@test.com' } }
}

function makeGetRequest(): Request {
    return new Request('http://localhost/api/notification-preferences', { method: 'GET' })
}

function makePatchRequest(body: unknown): Request {
    return new Request('http://localhost/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

// ─── GET /api/notification-preferences ───────────────────────────────────────

describe('GET /api/notification-preferences', () => {
    describe('authentification', () => {
        it('should return 401 with AUTH_007 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await GET(makeGetRequest())
            const body = await res.json()

            expect(res.status).toBe(401)
            expect(body.success).toBe(false)
            expect(body.error.code).toBe('AUTH_007')
        })
    })

    describe('lazy init — premier appel', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 200 with default values for a new user', async () => {
            const res = await GET(makeGetRequest())
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.channels.push).toBe(true)
            expect(body.data.channels.email).toBe(false)
        })

        it('should return all 7 types enabled by default', async () => {
            const res = await GET(makeGetRequest())
            const { types } = (await res.json()).data

            expect(types.exam_result).toBe(true)
            expect(types.exam_pending).toBe(true)
            expect(types.new_message).toBe(true)
            expect(types.forum_reply).toBe(true)
            expect(types.assistance_response).toBe(true)
            expect(types.rewards).toBe(true)
            expect(types.account).toBe(true)
        })

        it('should return quietHours disabled with Africa/Douala by default', async () => {
            const res = await GET(makeGetRequest())
            const { quietHours } = (await res.json()).data

            expect(quietHours.enabled).toBe(false)
            expect(quietHours.start).toBe('22:00')
            expect(quietHours.end).toBe('06:00')
            expect(quietHours.timezone).toBe('Africa/Douala')
        })

        it('should create a document in the database (lazy init)', async () => {
            const before = await NotificationPreferences.countDocuments()
            await GET(makeGetRequest())
            expect(await NotificationPreferences.countDocuments()).toBe(before + 1)
        })

        it('should NOT create a duplicate on second GET call', async () => {
            await GET(makeGetRequest())
            await GET(makeGetRequest())
            expect(await NotificationPreferences.countDocuments({ userId: USER_ID })).toBe(1)
        })
    })

    describe('lecture des préférences existantes', () => {
        it('should return stored preferences, not defaults', async () => {
            mockGetServerSession.mockResolvedValue(makeSession())

            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: false, email: false },
                types: {
                    exam_result: false, exam_pending: true, new_message: true,
                    forum_reply: false, assistance_response: true, rewards: false, account: true,
                },
                quietHours: { enabled: true, start: '23:00', end: '07:00', timezone: 'Europe/Paris' },
            })

            const res = await GET(makeGetRequest())
            const body = await res.json()

            expect(body.data.channels.push).toBe(false)
            expect(body.data.types.exam_result).toBe(false)
            expect(body.data.types.rewards).toBe(false)
            expect(body.data.quietHours.enabled).toBe(true)
            expect(body.data.quietHours.timezone).toBe('Europe/Paris')
        })
    })
})

// ─── PATCH /api/notification-preferences ─────────────────────────────────────

describe('PATCH /api/notification-preferences', () => {
    describe('authentification', () => {
        it('should return 401 with AUTH_007 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()

            expect(res.status).toBe(401)
            expect(body.error.code).toBe('AUTH_007')
        })
    })

    describe('validation du body', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 400 with NOTIF_006 when body has no recognized section', async () => {
            const res = await PATCH(makePatchRequest({}))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_006')
        })

        it('should return 400 with NOTIF_003 when channels is not an object', async () => {
            const res = await PATCH(makePatchRequest({ channels: 'invalid' }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_003')
        })

        it('should return 400 with NOTIF_004 for invalid HH:mm start (25:00)', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { start: '25:00' } }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_004')
            expect(body.error.context.field).toBe('quietHours.start')
            expect(body.error.context.receivedValue).toBe('25:00')
        })

        it('should return 400 with NOTIF_004 for missing leading zero (6:00)', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { start: '6:00' } }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_004')
        })

        it('should return 400 with NOTIF_005 for non-IANA timezone (UTC+1)', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { timezone: 'UTC+1' } }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_005')
            expect(body.error.context.receivedTimezone).toBe('UTC+1')
        })

        it('should return 400 with NOTIF_005 for GMT offset format (GMT+2)', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { timezone: 'GMT+2' } }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_005')
        })

        it('should NOT touch the DB when validation fails', async () => {
            const before = await NotificationPreferences.countDocuments()
            await PATCH(makePatchRequest({ quietHours: { start: '25:00' } }))
            expect(await NotificationPreferences.countDocuments()).toBe(before)
        })
    })

    describe('merge profond — channels', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return 200 and update only channels.push', async () => {
            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.channels.push).toBe(false)
            expect(body.data.channels.email).toBe(false)
        })

        it('should include all 3 sections in the response', async () => {
            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()

            expect(body.data).toHaveProperty('channels')
            expect(body.data).toHaveProperty('types')
            expect(body.data).toHaveProperty('quietHours')
        })
    })

    describe('merge profond — types', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should disable rewards without touching the 6 other types', async () => {
            const res = await PATCH(makePatchRequest({ types: { rewards: false } }))
            const { types } = (await res.json()).data

            expect(types.rewards).toBe(false)
            expect(types.exam_result).toBe(true)
            expect(types.new_message).toBe(true)
            expect(types.forum_reply).toBe(true)
            expect(types.assistance_response).toBe(true)
            expect(types.account).toBe(true)
        })

        it('should persist changes to the database', async () => {
            await PATCH(makePatchRequest({ types: { rewards: false } }))

            const doc = await NotificationPreferences.findOne({
                userId: new mongoose.Types.ObjectId(USER_ID),
            }).lean()

            expect(doc!.types.rewards).toBe(false)
            expect(doc!.types.exam_result).toBe(true)
        })
    })

    describe('merge profond — quietHours', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should enable quietHours without changing start/end/timezone', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { enabled: true } }))
            const { quietHours } = (await res.json()).data

            expect(quietHours.enabled).toBe(true)
            expect(quietHours.start).toBe('22:00')
            expect(quietHours.end).toBe('06:00')
            expect(quietHours.timezone).toBe('Africa/Douala')
        })

        it('should accept a valid IANA timezone (Europe/Paris)', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { timezone: 'Europe/Paris' } }))
            expect(res.status).toBe(200)
            const { quietHours } = (await res.json()).data
            expect(quietHours.timezone).toBe('Europe/Paris')
        })

        it('should accept valid HH:mm times', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { start: '21:30', end: '07:00' } }))
            const { quietHours } = (await res.json()).data
            expect(quietHours.start).toBe('21:30')
            expect(quietHours.end).toBe('07:00')
        })
    })

    describe('appels multiples successifs', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should accumulate changes across multiple PATCH calls', async () => {
            await PATCH(makePatchRequest({ channels: { push: false } }))
            await PATCH(makePatchRequest({ types: { rewards: false } }))
            await PATCH(makePatchRequest({ quietHours: { enabled: true } }))

            const res = await GET(makeGetRequest())
            const body = await res.json()

            expect(body.data.channels.push).toBe(false)
            expect(body.data.types.rewards).toBe(false)
            expect(body.data.quietHours.enabled).toBe(true)
            expect(body.data.types.exam_result).toBe(true)
        })

        it('should only create one document regardless of number of PATCH calls', async () => {
            await PATCH(makePatchRequest({ channels: { push: false } }))
            await PATCH(makePatchRequest({ types: { rewards: false } }))
            await PATCH(makePatchRequest({ quietHours: { enabled: true } }))

            expect(await NotificationPreferences.countDocuments({ userId: USER_ID })).toBe(1)
        })
    })

    describe('réponses bilingues', () => {
        beforeEach(() => {
            mockGetServerSession.mockResolvedValue(makeSession())
        })

        it('should return French message by default', async () => {
            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()
            expect(body.message).toBe('Préférences mises à jour')
        })

        it('should return English message with ?lang=en', async () => {
            const req = new Request('http://localhost/api/notification-preferences?lang=en', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channels: { push: false } }),
            })
            const res = await PATCH(req)
            const body = await res.json()
            expect(body.message).toBe('Preferences updated')
        })

        it('should return English error message with ?lang=en', async () => {
            const req = new Request('http://localhost/api/notification-preferences?lang=en', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quietHours: { start: '25:00' } }),
            })
            const res = await PATCH(req)
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error.code).toBe('NOTIF_004')
            expect(body.error.message).toMatch(/HH:mm/i)
        })
    })
})
