/**
 * Tests Unitaires : AuthService — Changement d'email (A-14)
 *
 * Tests de la logique métier sans appel HTTP.
 * Utilise MongoDB in-memory via le setup global.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals'
import { AuthService } from '@/lib/services/AuthService'
import { AuthRepository } from '@/lib/repositories/AuthRepository'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from '../../helpers/mongoMemory'

async function getEmailChangeFields(userId: string) {
  return User.findById(userId)
    .select('+emailChangeToken +emailChangeExpires +emailChangePending')
    .lean()
}

describe('AuthService — Email Change (A-14)', () => {
  const authService = new AuthService()
  const authRepo = new AuthRepository()
  const PASSWORD = 'SecurePass123!'
  const ORIGINAL_EMAIL = 'original@test.com'
  const NEW_EMAIL = 'new@test.com'
  let userId: string

  beforeAll(async () => {
    await connectMongoMemory()
  }, 30000)

  afterAll(async () => {
    await disconnectMongoMemory()
  })

  beforeEach(async () => {
    await User.deleteMany({})

    const hashed = await bcrypt.hash(PASSWORD, 1)
    const user = await User.create({
      email: ORIGINAL_EMAIL,
      name: 'Test User',
      role: 'TEACHER',
      password: hashed,
      emailVerified: true,
    })
    userId = user._id.toString()
  })

  // ── requestEmailChange ─────────────────────────────────────────

  describe('requestEmailChange', () => {
    it('should reject when password is missing', async () => {
      await expect(
        authService.requestEmailChange(userId, NEW_EMAIL, ''),
      ).rejects.toThrow('requis')
    })

    it('should reject when newEmail is missing', async () => {
      await expect(
        authService.requestEmailChange(userId, '', PASSWORD),
      ).rejects.toThrow('requis')
    })

    it('should reject when password is incorrect', async () => {
      await expect(
        authService.requestEmailChange(userId, NEW_EMAIL, 'wrong-password'),
      ).rejects.toThrow('Mot de passe incorrect')
    })

    it('should reject when new email equals current email', async () => {
      await expect(
        authService.requestEmailChange(userId, ORIGINAL_EMAIL, PASSWORD),
      ).rejects.toThrow('identique')
    })

    it('should reject when new email is already taken by another user', async () => {
      await User.create({
        email: NEW_EMAIL,
        name: 'Other',
        role: 'STUDENT',
        password: 'x',
      })

      await expect(
        authService.requestEmailChange(userId, NEW_EMAIL, PASSWORD),
      ).rejects.toThrow('déjà utilisé')
    })

    it('should reject invalid email format', async () => {
      await expect(
        authService.requestEmailChange(userId, 'not-an-email', PASSWORD),
      ).rejects.toThrow('invalide')
    })

    it('should reject for OAuth-only users (no password)', async () => {
      const oauthUser = await User.create({
        email: 'oauth@test.com',
        name: 'OAuth User',
        role: 'TEACHER',
        googleId: '123',
      })

      await expect(
        authService.requestEmailChange(oauthUser._id.toString(), NEW_EMAIL, 'any'),
      ).rejects.toThrow('OAuth')
    })

    it('should store hashed token and pending email in DB on success', async () => {
      await authService.requestEmailChange(userId, NEW_EMAIL, PASSWORD)

      const doc = await getEmailChangeFields(userId)

      expect(doc?.emailChangePending).toBe(NEW_EMAIL)
      expect(doc?.emailChangeToken).toBeDefined()
      expect(typeof doc?.emailChangeToken).toBe('string')
      expect(doc?.emailChangeToken?.length).toBe(64) // SHA256 hex
      expect(new Date(doc!.emailChangeExpires as Date).getTime()).toBeGreaterThan(Date.now())
    })

    it('should normalize email to lowercase', async () => {
      await authService.requestEmailChange(userId, 'NEW@TEST.COM', PASSWORD)

      const doc = await getEmailChangeFields(userId)

      expect(doc?.emailChangePending).toBe('new@test.com')
    })

    it('should overwrite a previous pending change', async () => {
      await authService.requestEmailChange(userId, 'first@test.com', PASSWORD)
      await authService.requestEmailChange(userId, 'second@test.com', PASSWORD)

      const doc = await getEmailChangeFields(userId)

      expect(doc?.emailChangePending).toBe('second@test.com')
    })
  })

  // ── confirmEmailChange ─────────────────────────────────────────

  describe('confirmEmailChange', () => {
    let rawToken: string

    beforeEach(async () => {
      rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

      await authRepo.saveEmailChangeToken(
        userId,
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000), // 1h
      )
    })

    it('should apply the new email', async () => {
      const result = await authService.confirmEmailChange(rawToken)

      expect(result.success).toBe(true)
      expect(result.newEmail).toBe(NEW_EMAIL)

      const user = await User.findById(userId)
      expect(user?.email).toBe(NEW_EMAIL)
    })

    it('should set emailVerified to true', async () => {
      await authService.confirmEmailChange(rawToken)

      const user = await User.findById(userId)
      expect(user?.emailVerified).toBe(true)
    })

    it('should clear all emailChange fields after confirmation', async () => {
      await authService.confirmEmailChange(rawToken)

      const doc = await getEmailChangeFields(userId)

      expect(doc?.emailChangeToken).toBeUndefined()
      expect(doc?.emailChangeExpires).toBeUndefined()
      expect(doc?.emailChangePending).toBeUndefined()
    })

    it('should reject reused token (one-time use)', async () => {
      await authService.confirmEmailChange(rawToken)

      await expect(
        authService.confirmEmailChange(rawToken),
      ).rejects.toThrow('invalide ou expiré')
    })

    it('should reject expired token', async () => {
      const expiredToken = crypto.randomBytes(32).toString('hex')
      const hashedExpired = crypto.createHash('sha256').update(expiredToken).digest('hex')

      await authRepo.saveEmailChangeToken(
        userId,
        hashedExpired,
        NEW_EMAIL,
        new Date(Date.now() - 60_000), // expired 1 min ago
      )

      await expect(
        authService.confirmEmailChange(expiredToken),
      ).rejects.toThrow('invalide ou expiré')
    })

    it('should reject empty token', async () => {
      await expect(
        authService.confirmEmailChange(''),
      ).rejects.toThrow('requis')
    })

    it('should reject random invalid token', async () => {
      await expect(
        authService.confirmEmailChange('aabbccdd1122334455'),
      ).rejects.toThrow('invalide ou expiré')
    })
  })

  // ── AuthRepository ─────────────────────────────────────────────

  describe('AuthRepository — email change methods', () => {
    it('clearEmailChangeToken should remove all pending fields', async () => {
      const token = crypto.randomBytes(32).toString('hex')
      const hashed = crypto.createHash('sha256').update(token).digest('hex')

      await authRepo.saveEmailChangeToken(userId, hashed, NEW_EMAIL, new Date(Date.now() + 3600_000))
      await authRepo.clearEmailChangeToken(userId)

      const doc = await getEmailChangeFields(userId)

      expect(doc?.emailChangeToken).toBeUndefined()
      expect(doc?.emailChangeExpires).toBeUndefined()
      expect(doc?.emailChangePending).toBeUndefined()
    })

    it('findByEmailChangeToken should return null for non-existent token', async () => {
      const fakeHash = crypto.createHash('sha256').update('nonexistent').digest('hex')
      const result = await authRepo.findByEmailChangeToken(fakeHash)
      expect(result).toBeNull()
    })
  })
})
