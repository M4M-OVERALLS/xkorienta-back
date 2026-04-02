/**
 * Tests Unitaires : UnverifiedSchoolService
 *
 * Agent 3 - Expert TDD
 * Service pour gérer les écoles non vérifiées
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';

// Mocks
const mockUnverifiedSchoolModel = {
  findOne: global.jest.fn<any>(),
  create: global.jest.fn<any>(),
  findByIdAndUpdate: global.jest.fn<any>(),
  updateMany: global.jest.fn<any>()
};

const mockUserModel = {
  updateMany: global.jest.fn<any>()
};

const mockSchoolModel = {
  create: global.jest.fn<any>(),
  findById: global.jest.fn<any>(),
  findByIdAndUpdate: global.jest.fn<any>()
};

const mockLearnerProfileModel = {
  updateMany: global.jest.fn<any>()
};

global.jest.mock('@/models/UnverifiedSchool', () => ({ __esModule: true, default: mockUnverifiedSchoolModel }));
global.jest.mock('@/models/User', () => ({ __esModule: true, default: mockUserModel }));
global.jest.mock('@/models/School', () => ({ __esModule: true, default: mockSchoolModel }));
global.jest.mock('@/models/LearnerProfile', () => ({ __esModule: true, default: mockLearnerProfileModel }));

// Service à tester (sera implémenté)
import { UnverifiedSchoolService } from '@/lib/services/UnverifiedSchoolService';

describe('UnverifiedSchoolService', () => {

  beforeEach(() => {
    // Reset all mocks
    global.jest.clearAllMocks();
  });

  describe('findOrCreate', () => {

    it('should find existing unverified school and add user to declaredBy', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const existingSchool = {
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'Lycée Bilingue de Yaoundé',
        declaredCount: 1,
        declaredBy: [new mongoose.Types.ObjectId()],
        status: 'PENDING',
        save: jest.fn<any>().mockResolvedValue(true)
      };

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(existingSchool);

      const schoolData = {
        name: 'lycée bilingue de yaoundé', // Minuscules
        city: 'Yaoundé',
        country: 'Cameroun'
      };

      // Act
      const result = await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      // Assert
      expect(mockUnverifiedSchoolModel.findOne).toHaveBeenCalledWith({
        declaredName: expect.stringMatching(/lycée bilingue/i),
        status: 'PENDING'
      });

      expect(existingSchool.declaredBy).toContain(userId);
      expect(existingSchool.declaredCount).toBe(2);
      expect(existingSchool.save).toHaveBeenCalled();
      expect((result as any)._id).toBe(existingSchool._id);
    });

    it('should create new unverified school if none exists', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const newSchoolId = new mongoose.Types.ObjectId();

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any);
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: newSchoolId,
        declaredName: 'Nouveau Lycée',
        declaredCount: 1,
        declaredBy: [userId],
        status: 'PENDING'
      });

      const schoolData = {
        name: 'Nouveau Lycée',
        city: 'Douala'
      };

      // Act
      const result = await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      // Assert
      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith({
        declaredName: 'Nouveau Lycée',
        declaredCity: 'Douala',
        declaredBy: [userId],
        declaredCount: 1,
        status: 'PENDING'
      });

      expect(result._id).toBe(newSchoolId);
    });

    it('should normalize school name before searching', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any);
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'lycée de douala',
        declaredCount: 1,
        status: 'PENDING'
      });

      const schoolData = {
        name: '  LYCÉE  de  DOUALA  ' // Espaces et casse différente
      };

      // Act
      await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      // Assert
      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declaredName: 'lycée de douala' // Normalisé
        })
      );
    });

    it('should not add duplicate user to declaredBy array', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const existingSchool = {
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'Test School',
        declaredCount: 1,
        declaredBy: [userId], // Utilisateur déjà présent
        status: 'PENDING',
        save: global.jest.fn<any>().mockResolvedValue(true)
      };

      mockUnverifiedSchoolModel.findOne.mockResolvedValue(existingSchool);

      const schoolData = { name: 'Test School' };

      // Act
      await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      // Assert
      expect(existingSchool.declaredBy).toHaveLength(1); // Pas de doublon
      expect(existingSchool.declaredCount).toBe(1); // Count non incrémenté
    });
  });

  describe('validateSchool', () => {

    it('should update status to VALIDATED and create official School', async () => {
      // Arrange
      const unverifiedSchoolId = new mongoose.Types.ObjectId();
      const newSchoolId = new mongoose.Types.ObjectId();

      const mockUnverifiedSchool = {
        _id: unverifiedSchoolId,
        declaredName: 'Lycée à Valider',
        declaredBy: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        status: 'PENDING'
      };

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        ...mockUnverifiedSchool,
        status: 'VALIDATED',
        matchedSchool: newSchoolId
      });

      const adminId = new mongoose.Types.ObjectId();
      mockSchoolModel.create.mockResolvedValue({ _id: newSchoolId });

      // Act
      const result = await UnverifiedSchoolService.validateSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        {
          name: 'Lycée à Valider',
          type: 'SECONDARY',
          city: 'Yaoundé'
        }
      );

      // Assert
      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'VALIDATED',
          matchedSchool: expect.any(mongoose.Types.ObjectId)
        },
        { new: true }
      );

      expect(result.success).toBe(true);
      expect(result.schoolId).toBeDefined();
    });

    it('should update all users with unverifiedSchool to official school', async () => {
      // Arrange
      const unverifiedSchoolId = new mongoose.Types.ObjectId();
      const newSchoolId = new mongoose.Types.ObjectId();

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'VALIDATED',
        matchedSchool: newSchoolId
      });

      mockUserModel.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const adminId = new mongoose.Types.ObjectId();
      mockSchoolModel.create.mockResolvedValue({ _id: newSchoolId });

      // Act
      await UnverifiedSchoolService.validateSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        { name: 'Test', type: 'SECONDARY' }
      );

      // Assert
      expect(mockUserModel.updateMany).toHaveBeenCalledWith(
        { unverifiedSchool: unverifiedSchoolId },
        {
          $addToSet: { schools: newSchoolId },
          $unset: { unverifiedSchool: '' }
        }
      );
    });
  });

  describe('mergeToExistingSchool', () => {

    it('should merge unverified school to existing validated school', async () => {
      // Arrange
      const unverifiedSchoolId = new mongoose.Types.ObjectId();
      const targetSchoolId = new mongoose.Types.ObjectId();

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'MERGED',
        matchedSchool: targetSchoolId
      });

      mockUserModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const adminId = new mongoose.Types.ObjectId();

      // Act
      const result = await UnverifiedSchoolService.mergeToExistingSchool(
        unverifiedSchoolId.toString(),
        targetSchoolId.toString(),
        adminId.toString()
      );

      // Assert
      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'MERGED',
          matchedSchool: targetSchoolId
        },
        { new: true }
      );

      expect(mockUserModel.updateMany).toHaveBeenCalledWith(
        { unverifiedSchool: unverifiedSchoolId },
        {
          $addToSet: { schools: targetSchoolId },
          $unset: { unverifiedSchool: '' }
        }
      );

      expect(result.success).toBe(true);
      expect(result.mergedCount).toBe(3);
    });
  });

  describe('rejectSchool', () => {

    it('should update status to REJECTED with notes', async () => {
      // Arrange
      const unverifiedSchoolId = new mongoose.Types.ObjectId();

      mockUnverifiedSchoolModel.findByIdAndUpdate.mockResolvedValue({
        _id: unverifiedSchoolId,
        status: 'REJECTED',
        notes: 'École fictive'
      });

      const adminId = new mongoose.Types.ObjectId();

      // Act
      const result = await UnverifiedSchoolService.rejectSchool(
        unverifiedSchoolId.toString(),
        adminId.toString(),
        'École fictive'
      );

      // Assert
      expect(mockUnverifiedSchoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        unverifiedSchoolId,
        {
          status: 'REJECTED',
          notes: 'École fictive'
        },
        { new: true }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Security: Sanitization', () => {

    it('should sanitize HTML from school name', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any);
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'lycée test'
      });

      const schoolData = {
        name: '<script>alert("XSS")</script>Lycée Test'
      };

      // Act
      await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      // Assert
      expect(mockUnverifiedSchoolModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declaredName: expect.not.stringContaining('<script>')
        })
      );
    });

    it('should reject school name longer than 200 characters', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const longName = 'A'.repeat(201);

      const schoolData = { name: longName };

      // Act & Assert
      await expect(
        UnverifiedSchoolService.findOrCreate(schoolData, userId)
      ).rejects.toThrow('Le nom de l\'école ne peut pas dépasser 200 caractères');
    });
  });

  describe('Performance Tests', () => {

    it('should complete findOrCreate in under 100ms', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      mockUnverifiedSchoolModel.findOne.mockResolvedValue(null as any);
      mockUnverifiedSchoolModel.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        declaredName: 'Test',
        declaredCount: 1
      });

      const schoolData = { name: 'Test School' };

      const startTime = Date.now();

      // Act
      await UnverifiedSchoolService.findOrCreate(schoolData, userId);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100);
    });
  });
});
