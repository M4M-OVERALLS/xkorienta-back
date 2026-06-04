/**
 * Tests d'intégration — GET & PATCH /api/notification-preferences
 *
 * Teste les routes HTTP complètes : auth, lazy init, merge profond, validation.
 * MongoDB : MongoMemoryServer — aucune base réelle requise.
 */

// ─── Mocks (avant tous les imports) ──────────────────────────────────────────

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
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
import { MongoMemoryServer } from 'mongodb-memory-server'
import { getServerSession } from 'next-auth'
import { GET, PATCH } from '@/app/api/notification-preferences/route'
import NotificationPreferences from '@/models/NotificationPreferences'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

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
        it('should return 401 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await GET()
            const body = await res.json()

            expect(res.status).toBe(401)
            expect(body.success).toBe(false)
        })
    })

    describe('lazy init — premier appel', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should return 200 with default values for a new user', async () => {
            const res = await GET()
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.channels.push).toBe(true)
            expect(body.data.channels.email).toBe(false)
        })

        it('should return all 7 types enabled by default', async () => {
            const res = await GET()
            const body = await res.json()

            const types = body.data.types
            expect(types.exam_result).toBe(true)
            expect(types.exam_pending).toBe(true)
            expect(types.new_message).toBe(true)
            expect(types.forum_reply).toBe(true)
            expect(types.assistance_response).toBe(true)
            expect(types.rewards).toBe(true)
            expect(types.account).toBe(true)
        })

        it('should return quietHours disabled with Africa/Douala timezone by default', async () => {
            const res = await GET()
            const body = await res.json()

            expect(body.data.quietHours.enabled).toBe(false)
            expect(body.data.quietHours.start).toBe('22:00')
            expect(body.data.quietHours.end).toBe('06:00')
            expect(body.data.quietHours.timezone).toBe('Africa/Douala')
        })

        it('should create a document in the database (lazy init)', async () => {
            const countBefore = await NotificationPreferences.countDocuments()
            await GET()
            const countAfter = await NotificationPreferences.countDocuments()

            expect(countAfter).toBe(countBefore + 1)
        })

        it('should NOT create a duplicate on second GET call', async () => {
            await GET()
            await GET()

            const count = await NotificationPreferences.countDocuments({ userId: USER_ID })
            expect(count).toBe(1)
        })
    })

    describe('lecture des préférences existantes', () => {
        it('should return the stored preferences, not the defaults', async () => {
            mockGetServerSession.mockResolvedValue(makeSession())

            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: false, email: false },
                types: {
                    exam_result: false,
                    exam_pending: true,
                    new_message: true,
                    forum_reply: false,
                    assistance_response: true,
                    rewards: false,
                    account: true,
                },
                quietHours: { enabled: true, start: '23:00', end: '07:00', timezone: 'Europe/Paris' },
            })

            const res = await GET()
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
        it('should return 401 when session is missing', async () => {
            mockGetServerSession.mockResolvedValue(null)

            const res = await PATCH(makePatchRequest({ channels: { push: false } }))

            expect(res.status).toBe(401)
        })
    })

    describe('validation du body', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should return 400 when body is empty (no section provided)', async () => {
            const res = await PATCH(makePatchRequest({}))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.success).toBe(false)
        })

        it('should return 400 when channels is not an object', async () => {
            const res = await PATCH(makePatchRequest({ channels: 'invalid' }))

            expect(res.status).toBe(400)
        })

        it('should return 400 for invalid HH:mm format in quietHours.start', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { start: '25:00' },
            }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.success).toBe(false)
            expect(body.message).toMatch(/HH:mm/i)
        })

        it('should return 400 for missing leading zero in time (6:00)', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { start: '6:00' },
            }))

            expect(res.status).toBe(400)
        })

        it('should return 400 for invalid IANA timezone (UTC+1)', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { timezone: 'UTC+1' },
            }))
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.success).toBe(false)
            expect(body.message).toMatch(/IANA/i)
        })

        it('should return 400 for offset format timezone (GMT+2)', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { timezone: 'GMT+2' },
            }))

            expect(res.status).toBe(400)
        })
    })

    describe('merge profond — channels', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should return 200 and update only channels.push', async () => {
            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.channels.push).toBe(false)
            expect(body.data.channels.email).toBe(false) // inchangé (défaut)
        })

        it('should return the complete merged object in the response', async () => {
            const res = await PATCH(makePatchRequest({ channels: { push: false } }))
            const body = await res.json()

            // La réponse doit contenir les 3 sections
            expect(body.data).toHaveProperty('channels')
            expect(body.data).toHaveProperty('types')
            expect(body.data).toHaveProperty('quietHours')
        })
    })

    describe('merge profond — types', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should disable rewards without touching the other 6 types', async () => {
            const res = await PATCH(makePatchRequest({ types: { rewards: false } }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.types.rewards).toBe(false)
            expect(body.data.types.exam_result).toBe(true)
            expect(body.data.types.new_message).toBe(true)
            expect(body.data.types.forum_reply).toBe(true)
            expect(body.data.types.assistance_response).toBe(true)
            expect(body.data.types.account).toBe(true)
        })

        it('should update multiple types in a single call', async () => {
            const res = await PATCH(makePatchRequest({
                types: { rewards: false, forum_reply: false, exam_result: false },
            }))
            const body = await res.json()

            expect(body.data.types.rewards).toBe(false)
            expect(body.data.types.forum_reply).toBe(false)
            expect(body.data.types.exam_result).toBe(false)
            expect(body.data.types.exam_pending).toBe(true) // inchangé
        })

        it('should persist the updated types in the database', async () => {
            await PATCH(makePatchRequest({ types: { rewards: false } }))

            const doc = await NotificationPreferences.findOne({
                userId: new mongoose.Types.ObjectId(USER_ID),
            }).lean()

            expect(doc!.types.rewards).toBe(false)
            expect(doc!.types.exam_result).toBe(true)
        })
    })

    describe('merge profond — quietHours', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should enable quietHours without changing start/end/timezone', async () => {
            const res = await PATCH(makePatchRequest({ quietHours: { enabled: true } }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.quietHours.enabled).toBe(true)
            expect(body.data.quietHours.start).toBe('22:00')
            expect(body.data.quietHours.end).toBe('06:00')
            expect(body.data.quietHours.timezone).toBe('Africa/Douala')
        })

        it('should update timezone to a valid IANA timezone', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { timezone: 'Europe/Paris' },
            }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.quietHours.timezone).toBe('Europe/Paris')
        })

        it('should update start and end times with valid HH:mm format', async () => {
            const res = await PATCH(makePatchRequest({
                quietHours: { start: '21:30', end: '07:00' },
            }))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.quietHours.start).toBe('21:30')
            expect(body.data.quietHours.end).toBe('07:00')
        })
    })

    describe('appels multiples successifs', () => {
        beforeEach(() => mockGetServerSession.mockResolvedValue(makeSession()))

        it('should accumulate changes across multiple PATCH calls', async () => {
            await PATCH(makePatchRequest({ channels: { push: false } }))
            await PATCH(makePatchRequest({ types: { rewards: false } }))
            await PATCH(makePatchRequest({ quietHours: { enabled: true } }))

            const res = await GET()
            const body = await res.json()

            expect(body.data.channels.push).toBe(false)
            expect(body.data.types.rewards).toBe(false)
            expect(body.data.quietHours.enabled).toBe(true)
            // Les autres valeurs restent à leurs defaults
            expect(body.data.types.exam_result).toBe(true)
            expect(body.data.channels.email).toBe(false)
        })

        it('should only create one document regardless of the number of PATCH calls', async () => {
            await PATCH(makePatchRequest({ channels: { push: false } }))
            await PATCH(makePatchRequest({ types: { rewards: false } }))
            await PATCH(makePatchRequest({ quietHours: { enabled: true } }))

            const count = await NotificationPreferences.countDocuments({ userId: USER_ID })
            expect(count).toBe(1)
        })
    })

    describe("cas 8 de la spec — filtrages validés", () => {
        it('should block PATCH and not touch DB when format is invalid', async () => {
            mockGetServerSession.mockResolvedValue(makeSession())

            const countBefore = await NotificationPreferences.countDocuments()

            await PATCH(makePatchRequest({ quietHours: { start: '25:00' } }))

            const countAfter = await NotificationPreferences.countDocuments()
            expect(countAfter).toBe(countBefore) // aucune création/modification
        })
    })
})
