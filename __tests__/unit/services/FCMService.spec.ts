/**
 * Tests Unitaires — FCMService
 *
 * Couvre : sendPushForNotification (gates, envoi multicast, cleanup tokens, lastUsedAt)
 * Firebase Admin est mocké — aucun appel réseau réel.
 * MongoDB : MongoMemoryServer (isolation complète)
 */

// ─── Mocks (déclarés avant tous les imports) ─────────────────────────────────

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

const mockSendEachForMulticast = jest.fn()
const mockMessaging = jest.fn().mockReturnValue({
    sendEachForMulticast: mockSendEachForMulticast,
})

jest.mock('@/lib/firebase', () => ({
    getFirebaseAdmin: jest.fn().mockReturnValue({
        messaging: mockMessaging,
    }),
}))

jest.mock('@/lib/services/NotificationPreferencesService', () => ({
    NotificationPreferencesService: {
        canSendPush: jest.fn().mockResolvedValue(true), // autorisé par défaut
    },
}))

// ─── Imports (après les mocks) ───────────────────────────────────────────────

import { describe, it, expect, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import { FCMService } from '@/lib/services/FCMService'
import NotificationDevice from '@/models/NotificationDevice'
import { NotificationPreferencesService } from '@/lib/services/NotificationPreferencesService'

beforeEach(async () => {
    await NotificationDevice.deleteMany({})
    jest.clearAllMocks()
    // Réinitialiser les mocks à leurs valeurs par défaut
    ;(NotificationPreferencesService.canSendPush as jest.Mock).mockResolvedValue(true)
    mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
    })
})

// ─── Fixture ─────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId()
const TOKEN_1 = 'valid_fcm_token_aaa'
const TOKEN_2 = 'valid_fcm_token_bbb'

function makeNotification(overrides: Partial<any> = {}): any {
    return {
        _id: new mongoose.Types.ObjectId(),
        userId: USER_ID,
        type: 'badge',
        title: 'Nouveau Badge! 🏆',
        message: 'Badge "Premier Examen" débloqué',
        data: { badgeId: 'badge_001' },
        ...overrides,
    }
}

// ─── sendPushForNotification ─────────────────────────────────────────────────

describe('FCMService.sendPushForNotification', () => {
    describe('skip conditions', () => {
        it('should skip when user has no registered devices', async () => {
            await FCMService.sendPushForNotification(makeNotification())

            expect(mockSendEachForMulticast).not.toHaveBeenCalled()
        })

        it('should skip when canSendPush returns false (preferences gate)', async () => {
            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_1,
                platform: 'android',
                lastUsedAt: new Date(),
            })

            ;(NotificationPreferencesService.canSendPush as jest.Mock).mockResolvedValue(false)

            await FCMService.sendPushForNotification(makeNotification())

            expect(mockSendEachForMulticast).not.toHaveBeenCalled()
        })

        it('should skip gracefully when Firebase is not initialized', async () => {
            const { getFirebaseAdmin } = await import('@/lib/firebase')
            ;(getFirebaseAdmin as jest.Mock).mockImplementationOnce(() => {
                throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
            })

            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_1,
                platform: 'android',
                lastUsedAt: new Date(),
            })

            await expect(
                FCMService.sendPushForNotification(makeNotification())
            ).resolves.not.toThrow()

            expect(mockSendEachForMulticast).not.toHaveBeenCalled()
        })
    })

    describe('envoi FCM', () => {
        beforeEach(async () => {
            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_1,
                platform: 'android',
                lastUsedAt: new Date(),
            })
        })

        it('should call sendEachForMulticast with the device token', async () => {
            await FCMService.sendPushForNotification(makeNotification())

            expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1)
            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.tokens).toContain(TOKEN_1)
        })

        it('should include notification title and body in the payload', async () => {
            const notif = makeNotification({ title: 'Test Title', message: 'Test Body' })
            await FCMService.sendPushForNotification(notif)

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.notification.title).toBe('Test Title')
            expect(payload.notification.body).toBe('Test Body')
        })

        it('should include notificationId in data payload', async () => {
            const notif = makeNotification()
            await FCMService.sendPushForNotification(notif)

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.notificationId).toBe(String(notif._id))
        })

        it('should include the correct Android channel_id', async () => {
            await FCMService.sendPushForNotification(makeNotification())

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.android.notification.channelId).toBe('xkorienta_default_channel')
        })

        it('should include APNs sound default', async () => {
            await FCMService.sendPushForNotification(makeNotification())

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.apns.payload.aps.sound).toBe('default')
        })

        it('should stringify all data values (FCM requirement)', async () => {
            const notif = makeNotification({
                data: { score: 18, passed: true, examId: new mongoose.Types.ObjectId() },
            })

            await FCMService.sendPushForNotification(notif)

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            const dataValues = Object.values(payload.data)
            dataValues.forEach(value => {
                expect(typeof value).toBe('string')
            })
        })

        it('should send to all devices of a user (multicast)', async () => {
            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_2,
                platform: 'ios',
                lastUsedAt: new Date(),
            })

            mockSendEachForMulticast.mockResolvedValue({
                successCount: 2,
                failureCount: 0,
                responses: [{ success: true }, { success: true }],
            })

            await FCMService.sendPushForNotification(makeNotification())

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.tokens).toHaveLength(2)
            expect(payload.tokens).toContain(TOKEN_1)
            expect(payload.tokens).toContain(TOKEN_2)
        })
    })

    describe('résolution des routes deep-link', () => {
        beforeEach(async () => {
            await NotificationDevice.create({ userId: USER_ID, token: TOKEN_1, platform: 'android', lastUsedAt: new Date() })
        })

        it('should resolve badge type to /profile/badges', async () => {
            await FCMService.sendPushForNotification(makeNotification({ type: 'badge' }))
            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.route).toBe('/profile/badges')
        })

        it('should resolve level_up and xp to /profile', async () => {
            await FCMService.sendPushForNotification(makeNotification({ type: 'level_up' }))
            let [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.route).toBe('/profile')

            jest.clearAllMocks()
            mockSendEachForMulticast.mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] })

            await FCMService.sendPushForNotification(makeNotification({ type: 'xp' }))
            ;[payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.route).toBe('/profile')
        })

        it('should resolve exam result with attemptId to /exam/:id/result', async () => {
            const examId = new mongoose.Types.ObjectId()
            const attemptId = new mongoose.Types.ObjectId()
            await FCMService.sendPushForNotification(makeNotification({
                type: 'success',
                data: { examId, attemptId },
            }))

            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.route).toBe(`/exam/${examId}/result`)
        })

        it('should fallback to /notifications for unknown type', async () => {
            await FCMService.sendPushForNotification(makeNotification({ type: 'unknown_xyz' }))
            const [payload] = mockSendEachForMulticast.mock.calls[0]
            expect(payload.data.route).toBe('/notifications')
        })
    })

    describe('cleanup des tokens invalides', () => {
        beforeEach(async () => {
            await NotificationDevice.create({ userId: USER_ID, token: TOKEN_1, platform: 'android', lastUsedAt: new Date() })
            await NotificationDevice.create({ userId: USER_ID, token: TOKEN_2, platform: 'ios', lastUsedAt: new Date() })
        })

        it('should delete permanently invalid tokens after failed send', async () => {
            mockSendEachForMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 1,
                responses: [
                    { success: true },
                    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
                ],
            })

            await FCMService.sendPushForNotification(makeNotification())

            const remaining = await NotificationDevice.countDocuments({ userId: USER_ID })
            expect(remaining).toBe(1)

            const kept = await NotificationDevice.findOne({ userId: USER_ID }).lean()
            expect(kept!.token).toBe(TOKEN_1)
        })

        it('should NOT delete tokens on temporary errors', async () => {
            mockSendEachForMulticast.mockResolvedValue({
                successCount: 0,
                failureCount: 2,
                responses: [
                    { success: false, error: { code: 'messaging/server-unavailable' } },
                    { success: false, error: { code: 'messaging/internal-error' } },
                ],
            })

            await FCMService.sendPushForNotification(makeNotification())

            const count = await NotificationDevice.countDocuments({ userId: USER_ID })
            expect(count).toBe(2) // aucun supprimé
        })
    })

    describe('mise à jour de lastUsedAt', () => {
        it('should update lastUsedAt for successfully reached devices', async () => {
            const before = new Date(Date.now() - 5000)
            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_1,
                platform: 'android',
                lastUsedAt: before,
            })

            await FCMService.sendPushForNotification(makeNotification())

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc!.lastUsedAt!.getTime()).toBeGreaterThan(before.getTime())
        })

        it('should NOT update lastUsedAt for failed tokens', async () => {
            const before = new Date(Date.now() - 5000)
            await NotificationDevice.create({
                userId: USER_ID,
                token: TOKEN_1,
                platform: 'android',
                lastUsedAt: before,
            })

            mockSendEachForMulticast.mockResolvedValue({
                successCount: 0,
                failureCount: 1,
                responses: [{ success: false, error: { code: 'messaging/server-unavailable' } }],
            })

            await FCMService.sendPushForNotification(makeNotification())

            const doc = await NotificationDevice.findOne({ token: TOKEN_1 }).lean()
            expect(doc!.lastUsedAt!.getTime()).toBeLessThanOrEqual(before.getTime() + 1000)
        })
    })
})
