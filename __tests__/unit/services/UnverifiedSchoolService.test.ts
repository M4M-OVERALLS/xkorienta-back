/**
 * Tests Unitaires : UnverifiedSchoolService
 *
 * Agent 3 - Expert TDD
 * Service pour gérer les écoles non vérifiées
 */

jest.mock('@/lib/services/SchoolSearchService', () => ({
  SchoolSearchService: {
    normalizeSchoolName: (input: string) => {
      if (!input) return ''
      return input
        .toLowerCase()
        .trim()
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, 'et')
        .replace(/&/g, 'et')
        .replace(/[^\wÀ-ÿ\s'\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    },
  },
}))

jest.mock('@/models/UnverifiedSchool', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}))

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    updateMany: jest.fn(),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    }),
  },
}))

jest.mock('@/models/School', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}))

jest.mock('@/models/LearnerProfile', () => ({
  __esModule: true,
  default: {
    updateMany: jest.fn(),
  },
}))

import { describe, it, expect, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import UnverifiedSchool from '@/models/UnverifiedSchool'
import User from '@/models/User'
import School from '@/models/School'
import { UnverifiedSchoolService } from '@/lib/services/UnverifiedSchoolService'

const mockUnverifiedSchoolModel = UnverifiedSchool as unknown as {
  findOne: jest.Mock
  create: jest.Mock
  findByIdAndUpdate: jest.Mock
  updateMany: jest.Mock
}

const mockUserModel = User as unknown as {
  updateMany: jest.Mock
  find: jest.Mock
}

const mockSchoolModel = School as unknown as {
  create: jest.Mock
  findById: jest.Mock
  findByIdAndUpdate: jest.Mock
}

describe('UnverifiedSchoolService', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    })
  })

  describe('findOrCreate', () => {

    it('should find existing unverified school and add user to declaredBy', async () => {
      const userId = new mongoose.Types.ObjectId()
      const existingSchool = {
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'lycée bilingue de yaoundé',
        declaredCount: 1,
        declaredBy: [new mongoose.Types.ObjectId()],
        status: 'PENDING',
        save: jest.fn<any>().mockResolvedValue(true),
      }

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(existingSchool)

      const schoolData = {
        name: 'lycée bilingue de yaoundé',
        city: 'Yaoundé',
        country: 'Cameroun',
      }

      const result = await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      expect(mockUnverifiedSchoolModel.findOne).toHaveBeenCalledWith({
        declaredName: { $regex: expect.any(RegExp) },
        status: 'PENDING',
      })

      expect(existingSchool.declaredBy).toContain(userId)
      expect(existingSchool.declaredCount).toBe(2)
      expect(existingSchool.save).toHaveBeenCalled()
      expect((result as any)._id).toBe(existingSchool._id)
    })

    it('should create new unverified school if none exists', async () => {
      const userId = new mongoose.Types.ObjectId()
      const newSchoolId = new mongoose.Types.ObjectId()

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any)
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: newSchoolId,
        declaredName: 'nouveau lycée',
        declaredCount: 1,
        declaredBy: [userId],
        status: 'PENDING',
      })

      const schoolData = {
        name: 'Nouveau Lycée',
        city: 'Douala',
      }

      const result = await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith({
        declaredName: 'nouveau lycée',
        declaredCity: 'douala',
        declaredCountry: undefined,
        declaredType: undefined,
        declaredBy: [userId],
        declaredCount: 1,
        status: 'PENDING',
      })

      expect(result._id).toBe(newSchoolId)
    })

    it('should normalize school name before searching', async () => {
      const userId = new mongoose.Types.ObjectId()
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any)
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'lycée de douala',
        declaredCount: 1,
        status: 'PENDING',
      })

      const schoolData = {
        name: '  LYCÉE  de  DOUALA  ',
      }

      await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declaredName: 'lycée de douala',
        })
      )
    })

    it('should not add duplicate user to declaredBy array', async () => {
      const userId = new mongoose.Types.ObjectId()
      const existingSchool = {
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'test school',
        declaredCount: 1,
        declaredBy: [userId],
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      }

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(existingSchool)

      const schoolData = { name: 'Test School' }

      await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      expect(existingSchool.declaredBy).toHaveLength(1)
      expect(existingSchool.declaredCount).toBe(1)
    })
  })

  describe('validateSchool', () => {

    it('should update status to VALIDATED and create official School', async () => {
      const unverifiedSchoolId = new mongoose.Types.ObjectId()
      const newSchoolId = new mongoose.Types.ObjectId()

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        declaredName: 'Lycée à Valider',
        declaredBy: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        status: 'VALIDATED',
        matchedSchool: newSchoolId,
      })

      const adminId = new mongoose.Types.ObjectId()
      mockSchoolModel.create.mockResolvedValue({ _id: newSchoolId })

      const result = await UnverifiedSchoolService.validateSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        {
          name: 'Lycée à Valider',
          type: 'SECONDARY',
          city: 'Yaoundé',
        }
      )

      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'VALIDATED',
          matchedSchool: newSchoolId,
        },
        { new: true }
      )

      expect(result.success).toBe(true)
      expect(result.schoolId).toBeDefined()
    })

    it('should update all users with unverifiedSchool to official school', async () => {
      const unverifiedSchoolId = new mongoose.Types.ObjectId()
      const newSchoolId = new mongoose.Types.ObjectId()

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'VALIDATED',
        matchedSchool: newSchoolId,
      })

      mockUserModel.updateMany.mockResolvedValue({ modifiedCount: 5 })

      const adminId = new mongoose.Types.ObjectId()
      mockSchoolModel.create.mockResolvedValue({ _id: newSchoolId })

      await UnverifiedSchoolService.validateSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        { name: 'Test', type: 'SECONDARY' }
      )

      expect(mockUserModel.updateMany).toHaveBeenCalledWith(
        { unverifiedSchool: unverifiedSchoolId },
        {
          $addToSet: { schools: newSchoolId },
          $unset: { unverifiedSchool: '' },
        }
      )
    })
  })

  describe('mergeToExistingSchool', () => {

    it('should merge unverified school to existing validated school', async () => {
      const unverifiedSchoolId = new mongoose.Types.ObjectId()
      const targetSchoolId = new mongoose.Types.ObjectId()

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'MERGED',
        matchedSchool: targetSchoolId,
      })

      mockUserModel.updateMany.mockResolvedValue({ modifiedCount: 3 })

      const adminId = new mongoose.Types.ObjectId()

      const result = await UnverifiedSchoolService.mergeToExistingSchool(
        unverifiedSchoolId.toString(),
        targetSchoolId.toString(),
        adminId.toString()
      )

      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'MERGED',
          matchedSchool: targetSchoolId,
        },
        { new: true }
      )

      expect(mockUserModel.updateMany).toHaveBeenCalledWith(
        { unverifiedSchool: unverifiedSchoolId },
        {
          $addToSet: { schools: targetSchoolId },
          $unset: { unverifiedSchool: '' },
        }
      )

      expect(result.success).toBe(true)
      expect(result.mergedCount).toBe(3)
    })
  })

  describe('rejectSchool', () => {

    it('should update status to REJECTED with notes', async () => {
      const unverifiedSchoolId = new mongoose.Types.ObjectId()

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'REJECTED',
        notes: 'École fictive',
      })

      const adminId = new mongoose.Types.ObjectId()

      const result = await UnverifiedSchoolService.rejectSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        'École fictive'
      )

      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'REJECTED',
          notes: 'École fictive',
        },
        { new: true }
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Security: Sanitization', () => {

    it('should sanitize HTML from school name', async () => {
      const userId = new mongoose.Types.ObjectId()
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any)
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'lycée test',
      })

      const schoolData = {
        name: '<script>alert("XSS")</script>Lycée Test',
      }

      await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declaredName: expect.not.stringContaining('<script>'),
        })
      )
    })

    it('should reject school name longer than 200 characters', async () => {
      const userId = new mongoose.Types.ObjectId()
      const longName = 'A'.repeat(201)

      const schoolData = { name: longName }

      await expect(
        UnverifiedSchoolService.findOrCreate(schoolData, userId)
      ).rejects.toThrow('Le nom de l\'école ne peut pas dépasser 200 caractères')
    })
  })

  describe('Performance Tests', () => {

    it('should complete findOrCreate in under 100ms', async () => {
      const userId = new mongoose.Types.ObjectId()
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any)
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'test',
        declaredCount: 1,
      })

      const schoolData = { name: 'Test School' }

      const startTime = Date.now()

      await UnverifiedSchoolService.findOrCreate(schoolData, userId)

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100)
    })
  })
})
