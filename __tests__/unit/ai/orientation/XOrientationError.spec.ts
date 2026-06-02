/**
 * Tests Unitaires — XOrientationError
 *
 * Verifie le comportement de la classe d'erreur dédiée au module
 * d'orientation IA Xkorienta : construction, sérialisation JSON,
 * journalisation Sentry et méthodes factory.
 */

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import { describe, it, expect, beforeEach } from '@jest/globals'
import * as Sentry from '@sentry/nextjs'
import { XOrientationError } from '@/lib/errors/core/XOrientationError'
import { BaseApplicationError } from '@/lib/errors/core/BaseError'

const mockCaptureException = Sentry.captureException as jest.MockedFunction<typeof Sentry.captureException>
const mockCaptureMessage = Sentry.captureMessage as jest.MockedFunction<typeof Sentry.captureMessage>

describe('XOrientationError', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // =========================================
    // CONSTRUCTOR
    // =========================================

    describe('constructor', () => {
        it('should build from XOR_001 with correct code and httpStatus', () => {
            const error = new XOrientationError('XOR_001')

            expect(error.code).toBe('XOR_001')
            expect(error.httpStatus).toBe(503)
            expect(error.category).toBe('CONFIGURATION')
            expect(error.severity).toBe('CRITICAL')
        })

        it('should use French message by default', () => {
            const error = new XOrientationError('XOR_001')

            expect(error.message).toBe("Service IA non configuré — clé API manquante")
        })

        it('should use English message when language is en', () => {
            const error = new XOrientationError('XOR_001', 'en')

            expect(error.message).toBe('AI service not configured — missing API key')
        })

        it('should fallback to XKOR_UNKNOWN for unknown code', () => {
            const error = new XOrientationError('XOR_999' as keyof typeof import('@/lib/errors/config/errorCatalog.json')['XORIENTATION'])

            expect(error.code).toBe('XOR_UNKNOWN')
            expect(error.httpStatus).toBe(500)
        })

        it('should attach context to the error', () => {
            const error = new XOrientationError('XOR_003', 'fr', { userId: 'u1' })

            expect(error.context).toBeDefined()
            expect(error.context!.userId).toBe('u1')
        })

        it('should pass instanceof BaseApplicationError check', () => {
            const error = new XOrientationError('XOR_001')

            expect(error instanceof BaseApplicationError).toBe(true)
        })

        it('should pass instanceof XOrientationError check', () => {
            const error = new XOrientationError('XOR_001')

            expect(error instanceof XOrientationError).toBe(true)
        })
    })

    // =========================================
    // toJSON
    // =========================================

    describe('toJSON', () => {
        it('should return success:false with error object', () => {
            const error = new XOrientationError('XOR_001')
            const json = error.toJSON()

            expect(json.success).toBe(false)
            expect(json.error.code).toBe('XOR_001')
        })

        it('should include timestamp in ISO format', () => {
            const error = new XOrientationError('XOR_001')
            const json = error.toJSON()
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

            expect(json.error.timestamp).toMatch(isoRegex)
        })
    })

    // =========================================
    // log — Sentry integration
    // =========================================

    describe('log', () => {
        it('should call Sentry.captureException for CRITICAL severity', () => {
            const error = new XOrientationError('XOR_001') // CRITICAL

            error.log()

            expect(mockCaptureException).toHaveBeenCalledTimes(1)
            expect(mockCaptureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({ level: 'fatal' })
            )
        })

        it('should call Sentry.captureMessage for WARNING severity', () => {
            const error = new XOrientationError('XOR_004') // WARNING

            error.log()

            expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
            expect(mockCaptureMessage).toHaveBeenCalledWith(
                error.message,
                expect.objectContaining({ level: 'warning' })
            )
        })
    })

    // =========================================
    // FACTORY METHODS
    // =========================================

    describe('factory methods', () => {
        it('apiKeyMissing() returns XOR_001 with httpStatus 503', () => {
            const error = XOrientationError.apiKeyMissing()

            expect(error.code).toBe('XOR_001')
            expect(error.httpStatus).toBe(503)
        })

        it('invalidJsonBody() returns XOR_002 with httpStatus 400', () => {
            const error = XOrientationError.invalidJsonBody()

            expect(error.code).toBe('XOR_002')
            expect(error.httpStatus).toBe(400)
        })

        it('invalidParameters() returns XOR_003 with context attached', () => {
            const ctx = { field: 'messages', reason: 'empty' }
            const error = XOrientationError.invalidParameters('fr', ctx)

            expect(error.code).toBe('XOR_003')
            expect(error.context).toMatchObject(ctx)
        })

        it('rateLimitExceeded() returns XOR_004 with httpStatus 429', () => {
            const error = XOrientationError.rateLimitExceeded()

            expect(error.code).toBe('XOR_004')
            expect(error.httpStatus).toBe(429)
        })

        it('anthropicError() returns XOR_005 with cause in context', () => {
            const error = XOrientationError.anthropicError('Connection refused')

            expect(error.code).toBe('XOR_005')
            expect(error.context).toBeDefined()
            expect(error.context!.cause).toBe('Connection refused')
        })

        it('streamError() returns XOR_006', () => {
            const error = XOrientationError.streamError('stream aborted')

            expect(error.code).toBe('XOR_006')
        })

        it('registrationFailed() returns XOR_007 with cause in context', () => {
            const error = XOrientationError.registrationFailed('Duplicate key')

            expect(error.code).toBe('XOR_007')
            expect(error.context).toBeDefined()
            expect(error.context!.cause).toBe('Duplicate key')
        })

        it('invalidLevel() returns XOR_008 with level in context', () => {
            const error = XOrientationError.invalidLevel('UNKNOWN_LEVEL')

            expect(error.code).toBe('XOR_008')
            expect(error.context).toBeDefined()
            expect(error.context!.level).toBe('UNKNOWN_LEVEL')
        })

        it('conversationTooLong() returns XOR_009 with messageCount in context', () => {
            const error = XOrientationError.conversationTooLong(55)

            expect(error.code).toBe('XOR_009')
            expect(error.context).toBeDefined()
            expect(error.context!.messageCount).toBe(55)
        })

        it('serviceUnavailable() returns XOR_010 with httpStatus 503', () => {
            const error = XOrientationError.serviceUnavailable()

            expect(error.code).toBe('XOR_010')
            expect(error.httpStatus).toBe(503)
        })

        it('all factory methods return instances of XOrientationError', () => {
            const factories = [
                XOrientationError.apiKeyMissing(),
                XOrientationError.invalidJsonBody(),
                XOrientationError.invalidParameters(),
                XOrientationError.rateLimitExceeded(),
                XOrientationError.anthropicError('err'),
                XOrientationError.streamError('err'),
                XOrientationError.registrationFailed('err'),
                XOrientationError.invalidLevel('X'),
                XOrientationError.conversationTooLong(51),
                XOrientationError.serviceUnavailable(),
            ]

            for (const err of factories) {
                expect(err instanceof XOrientationError).toBe(true)
                expect(err instanceof BaseApplicationError).toBe(true)
            }
        })
    })
})
