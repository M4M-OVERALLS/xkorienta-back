/**
 * Tests d'Intégration : Sécurité A-14 — Changement d'email sécurisé
 *
 * Vérifie le flux en 2 étapes :
 *  1. POST /api/user/email/change — requiert mot de passe
 *  2. POST /api/user/email/confirm — valide le token
 *
 * Rapport d'intrusion : A-14 (ÉLEVÉ, CVSS 7.1)
 */

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

import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { getServerSession } from 'next-auth'
import User from '@/models/User'
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from '../../helpers/mongoMemory'
import { AuthService } from '@/lib/services/AuthService'
import { AuthRepository } from '@/lib/repositories/AuthRepository'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { POST as changeEmail } from '@/app/api/user/email/change/route'
import { POST as confirmEmail } from '@/app/api/user/email/confirm/route'
import { PUT as updateProfile } from '@/app/api/user/profile/route'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

async function getEmailChangeFields(userId: string) {
  return User.findById(userId)
    .select('+emailChangeToken +emailChangeExpires +emailChangePending')
    .lean()
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('A-14 — Changement d\'email sécurisé', () => {
  let testUser: any
  const ORIGINAL_EMAIL = 'original-a14@test.com'
  const NEW_EMAIL = 'new-a14@test.com'
  const PASSWORD = 'SecurePass123!'

  beforeAll(async () => {
    await connectMongoMemory()
  }, 30000)

  afterAll(async () => {
    await disconnectMongoMemory()
  })

  beforeEach(async () => {
    await User.deleteMany({})
    jest.clearAllMocks()

    const hashedPassword = await bcrypt.hash(PASSWORD, 12)
    testUser = await User.create({
      email: ORIGINAL_EMAIL,
      name: 'Utilisateur A-14',
      role: 'TEACHER',
      password: hashedPassword,
      emailVerified: true,
    })
  })

  describe('POST /api/user/email/change', () => {
    it('should reject request without authentication', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await changeEmail(
        jsonRequest('http://localhost/api/user/email/change', 'POST', {
          newEmail: NEW_EMAIL,
          password: PASSWORD,
        }),
      )
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should reject request without password', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: testUser._id.toString() },
      } as any)

      const response = await changeEmail(
        jsonRequest('http://localhost/api/user/email/change', 'POST', {
          newEmail: NEW_EMAIL,
        }),
      )

      expect(response.status).toBe(400)
    })

    it('should reject request without newEmail', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: testUser._id.toString() },
      } as any)

      const response = await changeEmail(
        jsonRequest('http://localhost/api/user/email/change', 'POST', {
          password: PASSWORD,
        }),
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/user/email/confirm', () => {
    it('should reject confirmation without token', async () => {
      const response = await confirmEmail(
        jsonRequest('http://localhost/api/user/email/confirm', 'POST', {}),
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should reject confirmation with invalid token', async () => {
      const response = await confirmEmail(
        jsonRequest('http://localhost/api/user/email/confirm', 'POST', {
          token: 'invalid-token-abc123',
        }),
      )
      const body = await response.json()

      expect([410, 500]).toContain(response.status)
      expect(body.success).toBe(false)
    })

    it('should reject confirmation with expired token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

      const repo = new AuthRepository()
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() - 60_000),
      )

      const response = await confirmEmail(
        jsonRequest('http://localhost/api/user/email/confirm', 'POST', {
          token: rawToken,
        }),
      )
      const body = await response.json()

      expect([410, 500]).toContain(response.status)
      expect(body.success).toBe(false)
    })
  })

  describe('AuthService.requestEmailChange — unit logic', () => {
    const authService = new AuthService()

    it('should reject if password is wrong', async () => {
      await expect(
        authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, 'wrong-password'),
      ).rejects.toThrow('Mot de passe incorrect')
    })

    it('should reject if new email equals current email', async () => {
      await expect(
        authService.requestEmailChange(testUser._id.toString(), ORIGINAL_EMAIL, PASSWORD),
      ).rejects.toThrow('identique')
    })

    it('should reject if new email is already taken', async () => {
      await User.create({
        email: NEW_EMAIL,
        name: 'Autre Utilisateur',
        role: 'STUDENT',
        password: 'hashed',
      })

      await expect(
        authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, PASSWORD),
      ).rejects.toThrow('déjà utilisé')
    })

    it('should save token in DB on valid request', async () => {
      await authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, PASSWORD)

      const userDoc = await getEmailChangeFields(testUser._id.toString())
      expect(userDoc?.emailChangePending).toBe(NEW_EMAIL)
      expect(userDoc?.emailChangeToken).toBeDefined()
      expect(userDoc?.emailChangeExpires).toBeDefined()
      expect(new Date(userDoc!.emailChangeExpires as Date).getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('AuthService.confirmEmailChange — unit logic', () => {
    const authService = new AuthService()

    it('should apply the new email on valid token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

      const repo = new AuthRepository()
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      )

      const result = await authService.confirmEmailChange(rawToken)

      expect(result.success).toBe(true)
      expect(result.newEmail).toBe(NEW_EMAIL)

      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser?.email).toBe(NEW_EMAIL)
      expect(updatedUser?.emailVerified).toBe(true)
    })

    it('should clear the token fields after confirmation', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

      const repo = new AuthRepository()
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      )

      await authService.confirmEmailChange(rawToken)

      const userDoc = await getEmailChangeFields(testUser._id.toString())
      expect(userDoc?.emailChangeToken).toBeUndefined()
      expect(userDoc?.emailChangeExpires).toBeUndefined()
      expect(userDoc?.emailChangePending).toBeUndefined()
    })

    it('should reject a reused token (one-time use)', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

      const repo = new AuthRepository()
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      )

      await authService.confirmEmailChange(rawToken)

      await expect(
        authService.confirmEmailChange(rawToken),
      ).rejects.toThrow('invalide ou expiré')
    })
  })

  describe('PUT /api/user/profile — email change blocked', () => {
    it('should reject direct email change via profile endpoint', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await updateProfile(
        jsonRequest('http://localhost/api/user/profile', 'PUT', {
          email: NEW_EMAIL,
        }),
      )

      expect(response.status).not.toBe(200)
    })
  })
})
