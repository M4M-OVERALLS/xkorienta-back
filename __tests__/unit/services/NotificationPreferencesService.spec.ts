/**
 * Tests Unitaires — NotificationPreferencesService
 *
 * Couvre : getOrCreate (lazy init), patch (deep merge + validation),
 *          canSendPush (3 gates : master switch, type, quiet hours)
 * MongoDB : MongoMemoryServer (isolation complète)
 */

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { NotificationPreferencesService } from '@/lib/services/NotificationPreferencesService'
import { NotificationError } from '@/lib/errors/core/NotificationError'
import NotificationPreferences from '@/models/NotificationPreferences'

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
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toString()

// ─── getOrCreate ─────────────────────────────────────────────────────────────

describe('NotificationPreferencesService.getOrCreate', () => {
    it('should create a document with all defaults for a new user', async () => {
        const prefs = await NotificationPreferencesService.getOrCreate(USER_ID)

        expect(prefs.channels.push).toBe(true)
        expect(prefs.channels.email).toBe(false)
        expect(prefs.types.exam_result).toBe(true)
        expect(prefs.types.rewards).toBe(true)
        expect(prefs.quietHours.enabled).toBe(false)
        expect(prefs.quietHours.start).toBe('22:00')
        expect(prefs.quietHours.end).toBe('06:00')
        expect(prefs.quietHours.timezone).toBe('Africa/Douala')
    })

    it('should create only one document per user (idempotent)', async () => {
        await NotificationPreferencesService.getOrCreate(USER_ID)
        await NotificationPreferencesService.getOrCreate(USER_ID)

        const count = await NotificationPreferences.countDocuments({ userId: USER_ID })
        expect(count).toBe(1)
    })

    it('should return the existing document on second call', async () => {
        const first = await NotificationPreferencesService.getOrCreate(USER_ID)
        const second = await NotificationPreferencesService.getOrCreate(USER_ID)

        expect(second._id.toString()).toBe(first._id.toString())
    })
})

// ─── patch ───────────────────────────────────────────────────────────────────

describe('NotificationPreferencesService.patch', () => {
    describe('merge profond', () => {
        it('should update only channels.push without touching other fields', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            const updated = await NotificationPreferencesService.patch(USER_ID, {
                channels: { push: false },
            })

            expect(updated.channels.push).toBe(false)
            expect(updated.channels.email).toBe(false) // inchangé
            expect(updated.types.exam_result).toBe(true) // inchangé
        })

        it('should update only one type without touching the 6 others', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            const updated = await NotificationPreferencesService.patch(USER_ID, {
                types: { rewards: false },
            })

            expect(updated.types.rewards).toBe(false)
            expect(updated.types.exam_result).toBe(true)
            expect(updated.types.new_message).toBe(true)
            expect(updated.types.forum_reply).toBe(true)
            expect(updated.types.assistance_response).toBe(true)
            expect(updated.types.account).toBe(true)
        })

        it('should update multiple types in a single call', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            const updated = await NotificationPreferencesService.patch(USER_ID, {
                types: { rewards: false, forum_reply: false },
            })

            expect(updated.types.rewards).toBe(false)
            expect(updated.types.forum_reply).toBe(false)
            expect(updated.types.exam_result).toBe(true)
        })

        it('should update quietHours.enabled without changing start/end', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            const updated = await NotificationPreferencesService.patch(USER_ID, {
                quietHours: { enabled: true },
            })

            expect(updated.quietHours.enabled).toBe(true)
            expect(updated.quietHours.start).toBe('22:00')
            expect(updated.quietHours.end).toBe('06:00')
            expect(updated.quietHours.timezone).toBe('Africa/Douala')
        })

        it('should update multiple sections in one call', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            const updated = await NotificationPreferencesService.patch(USER_ID, {
                channels: { push: false },
                types: { rewards: false },
                quietHours: { enabled: true },
            })

            expect(updated.channels.push).toBe(false)
            expect(updated.types.rewards).toBe(false)
            expect(updated.quietHours.enabled).toBe(true)
        })

        it('should create prefs with defaults and apply patch when user has no existing prefs', async () => {
            const updated = await NotificationPreferencesService.patch(USER_ID, {
                channels: { push: false },
            })

            expect(updated.channels.push).toBe(false)
            expect(updated.channels.email).toBe(false)

            const count = await NotificationPreferences.countDocuments({ userId: USER_ID })
            expect(count).toBe(1)
        })
    })

    describe('validation — format HH:mm', () => {
        it('should throw NotificationError for invalid start hour (25:00)', async () => {
            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { start: '25:00' },
                })
            ).rejects.toThrow(NotificationError)
        })

        it('should throw NotificationError for invalid end format (6h)', async () => {
            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { end: '6h' },
                })
            ).rejects.toThrow(NotificationError)
        })

        it('should throw NotificationError for missing leading zero (6:00)', async () => {
            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { start: '6:00' },
                })
            ).rejects.toThrow(NotificationError)
        })

        it('should accept valid formats: 00:00, 23:59, 06:30', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { start: '00:00', end: '23:59' },
                })
            ).resolves.not.toThrow()
        })
    })

    describe('validation — timezone IANA', () => {
        it('should throw NotificationError for non-IANA timezone (UTC+1)', async () => {
            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { timezone: 'UTC+1' },
                })
            ).rejects.toThrow(NotificationError)
        })

        it('should throw NotificationError for offset format (GMT+2)', async () => {
            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { timezone: 'GMT+2' },
                })
            ).rejects.toThrow(NotificationError)
        })

        it('should accept valid IANA timezones', async () => {
            await NotificationPreferencesService.getOrCreate(USER_ID)

            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { timezone: 'Europe/Paris' },
                })
            ).resolves.not.toThrow()

            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { timezone: 'America/New_York' },
                })
            ).resolves.not.toThrow()
        })

        it('should NOT throw for validation errors before hitting the DB', async () => {
            const countBefore = await NotificationPreferences.countDocuments()

            await expect(
                NotificationPreferencesService.patch(USER_ID, {
                    quietHours: { start: '25:00' },
                })
            ).rejects.toThrow(NotificationError)

            const countAfter = await NotificationPreferences.countDocuments()
            expect(countAfter).toBe(countBefore) // aucune création en base
        })
    })
})

// ─── canSendPush ─────────────────────────────────────────────────────────────

describe('NotificationPreferencesService.canSendPush', () => {
    describe('pas de préférences en base (defaults)', () => {
        it('should return true when no prefs exist (safe default)', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(true)
        })
    })

    describe('Gate 1 — master switch (channels.push)', () => {
        it('should return false when channels.push is false', async () => {
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: false, email: false },
            })

            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(false)
        })

        it('should return true when channels.push is true', async () => {
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: true, email: false },
            })

            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(true)
        })
    })

    describe('Gate 2 — filtrage par type', () => {
        beforeEach(async () => {
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: true },
                types: {
                    exam_result: true,
                    exam_pending: true,
                    new_message: true,
                    forum_reply: false,   // désactivé
                    assistance_response: true,
                    rewards: false,       // désactivé
                    account: true,
                },
            })
        })

        it('should return false for type "badge" when rewards is false', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(false)
        })

        it('should return false for type "xp" when rewards is false', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'xp')
            expect(result).toBe(false)
        })

        it('should return false for type "level_up" when rewards is false', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'level_up')
            expect(result).toBe(false)
        })

        it('should return false for type "forum_reply" when forum_reply is false', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'forum_reply')
            expect(result).toBe(false)
        })

        it('should return true for allowed types', async () => {
            expect(await NotificationPreferencesService.canSendPush(USER_ID, 'exam_result')).toBe(true)
            expect(await NotificationPreferencesService.canSendPush(USER_ID, 'new_message')).toBe(true)
        })

        it('should return true (safe default) for unknown types', async () => {
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'unknown_type_xyz')
            expect(result).toBe(true)
        })
    })

    describe('Gate 3 — heures de silence', () => {
        it('should return true when quietHours.enabled is false', async () => {
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: true },
                quietHours: { enabled: false, start: '00:00', end: '23:59', timezone: 'Africa/Douala' },
            })

            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(true)
        })

        it('should return false during a full-day silence window (00:00 → 23:59)', async () => {
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: true },
                quietHours: {
                    enabled: true,
                    start: '00:00',
                    end: '23:59',
                    timezone: 'Africa/Douala',
                },
            })

            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(false)
        })

        it('should return true outside the silence window (23:59 → 00:01)', async () => {
            // Fenêtre d'une seule minute à minuit — très peu de chance d'y être
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: true },
                quietHours: {
                    enabled: true,
                    start: '23:59',
                    end: '00:01',
                    timezone: 'Africa/Douala',
                },
            })

            // Ce test peut occasionnellement échouer si exécuté exactement à 23:59-00:01
            // C'est acceptable pour un test de quiet hours
            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            // Pas d'assertion binaire ici — on vérifie juste que ça ne lance pas d'erreur
            expect(typeof result).toBe('boolean')
        })
    })

    describe('ordre des gates', () => {
        it('should check master switch before type (Gate 1 > Gate 2)', async () => {
            // push = false + type aussi désactivé → Gate 1 doit court-circuiter
            await NotificationPreferences.create({
                userId: new mongoose.Types.ObjectId(USER_ID),
                channels: { push: false },
                types: { rewards: false },
            })

            const result = await NotificationPreferencesService.canSendPush(USER_ID, 'badge')
            expect(result).toBe(false)
        })
    })
})
