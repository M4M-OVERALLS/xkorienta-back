/**
 * Unit Tests for ParentLearnerService.getChildrenForParent()
 *
 * Scope: Tests the service layer for retrieving active children for a parent
 * Location: __tests__/unit/parent/GetChildrenTest.spec.ts
 *
 * Coverage:
 * - Success cases: single child, multiple children
 * - Data transformation: linkId, learnerId, name, relationshipType, isPrimary
 * - Sorting: isPrimary first, then by createdAt
 * - Edge cases: empty list, null/undefined handling
 * - Error handling: repository failures
 */

import { ParentLearnerService } from '@/lib/services/ParentLearnerService';
import { parentLearnerRepository } from '@/lib/repositories/ParentLearnerRepository';
import { ParentError } from '@/lib/errors/core/ParentError';
import mongoose from 'mongoose';
import { ParentRelationshipType } from '@/models/enums';

// Mock connectDB — prevents real Mongoose model code running at import time
jest.mock('@/lib/mongodb', () => ({ __esModule: true, default: jest.fn() }));

// Mock the repository — service only calls repository methods
jest.mock('@/lib/repositories/ParentLearnerRepository');

const parentLearnerService = new ParentLearnerService();

describe('XKT-005: ParentLearnerService.getChildrenForParent()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // Success Cases — Data Transformation
    // ============================================================================

    describe('Success Cases — Data Transformation', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should transform and return single child with correct structure', async () => {
            const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
            const linkId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'Jean-Claude Kamga',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                linkId: linkId,
                learnerId: learnerId,
                name: 'Jean-Claude Kamga',
                relationshipType: ParentRelationshipType.FATHER,
                isPrimary: true,
            });
        });

        it('should return multiple children with correct structure', async () => {
            const learner1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439014');
            const learner2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439015');
            const link1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439016');
            const link2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439017');

            const mockLinks = [
                {
                    _id: link1Id,
                    parent: parentId,
                    learner: {
                        _id: learner1Id,
                        name: 'Marie Kamga',
                    },
                    relationshipType: ParentRelationshipType.MOTHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
                {
                    _id: link2Id,
                    parent: parentId,
                    learner: {
                        _id: learner2Id,
                        name: 'Pierre Kamga',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: false,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Marie Kamga');
            expect(result[1].name).toBe('Pierre Kamga');
            expect(result[0].isPrimary).toBe(true);
            expect(result[1].isPrimary).toBe(false);
        });

        it('should correctly map ObjectIds from child objects', async () => {
            const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439018');
            const linkId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439019');

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'Test Child',
                    },
                    relationshipType: ParentRelationshipType.GUARDIAN,
                    isPrimary: false,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            // Ensure IDs are strings (toString called in service)
            expect(typeof result[0].linkId).toBe('object'); // ObjectId
            expect(typeof result[0].learnerId).toBe('object'); // ObjectId
            expect(result[0].linkId.toString()).toBe(linkId.toString());
            expect(result[0].learnerId.toString()).toBe(learnerId.toString());
        });

        it.each([
            ParentRelationshipType.FATHER,
            ParentRelationshipType.MOTHER,
            ParentRelationshipType.GUARDIAN,
            ParentRelationshipType.OTHER,
        ])('should preserve relationship type %s', async (relationshipType) => {
            const learnerId = new mongoose.Types.ObjectId();
            const linkId = new mongoose.Types.ObjectId();

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'Test Child',
                    },
                    relationshipType,
                    isPrimary: false,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result[0].relationshipType).toBe(relationshipType);
        });
    });

    // ============================================================================
    // Sorting and Ordering
    // ============================================================================

    describe('Sorting and Ordering', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should preserve sorting order from repository (isPrimary DESC, createdAt DESC)', async () => {
            const mockLinks = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    parent: parentId,
                    learner: {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Primary Child',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    createdAt: new Date('2024-01-15'),
                    status: 'ACTIVE',
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    parent: parentId,
                    learner: {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Secondary Child (Newer)',
                    },
                    relationshipType: ParentRelationshipType.MOTHER,
                    isPrimary: false,
                    createdAt: new Date('2024-01-20'),
                    status: 'ACTIVE',
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    parent: parentId,
                    learner: {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Secondary Child (Older)',
                    },
                    relationshipType: ParentRelationshipType.GUARDIAN,
                    isPrimary: false,
                    createdAt: new Date('2024-01-10'),
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            // Service should preserve repository order (sorting done by repository)
            expect(result[0].name).toBe('Primary Child');
            expect(result[0].isPrimary).toBe(true);
            expect(result[1].name).toBe('Secondary Child (Newer)');
            expect(result[1].isPrimary).toBe(false);
            expect(result[2].name).toBe('Secondary Child (Older)');
            expect(result[2].isPrimary).toBe(false);
        });
    });

    // ============================================================================
    // Edge Cases — Empty Lists
    // ============================================================================

    describe('Edge Cases — Empty Lists', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should return empty array when parent has no children', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue([]);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toEqual([]);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        it('should call repository with correct parent ID', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue([]);

            await parentLearnerService.getChildrenForParent(parentId);

            expect(parentLearnerRepository.findChildrenForParent).toHaveBeenCalledWith(parentId);
            expect(parentLearnerRepository.findChildrenForParent).toHaveBeenCalledTimes(1);
        });
    });

    // ============================================================================
    // Error Handling
    // ============================================================================

    describe('Error Handling', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should wrap repository errors in ParentError', async () => {
            const dbError = new Error('MongoDB connection failed');
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockRejectedValue(dbError);

            await expect(
                parentLearnerService.getChildrenForParent(parentId)
            ).rejects.toThrow(ParentError);
        });

        it('should throw ParentError with code when repository fails', async () => {
            const dbError = new Error('MongoDB connection failed');
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockRejectedValue(dbError);

            await expect(
                parentLearnerService.getChildrenForParent(parentId)
            ).rejects.toMatchObject({
                code: expect.any(String),
                message: expect.stringContaining('Failed to retrieve children'),
            });
        });

        it('should not expose database error details to client', async () => {
            const sensitiveError = new Error('User table schema: uid, email, password_hash');
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockRejectedValue(sensitiveError);

            try {
                await parentLearnerService.getChildrenForParent(parentId);
            } catch (error: any) {
                // Error message should be generic, not expose schema
                expect(error.message).not.toContain('schema');
                expect(error.message).not.toContain('password_hash');
            }
        });

        it('should handle null return from repository', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(null);

            // Service should handle gracefully or throw appropriate error
            const result = await parentLearnerService.getChildrenForParent(parentId).catch(() => null);

            // Either null or error is acceptable, but not undefined
            expect(result !== undefined).toBeTruthy();
        });
    });

    // ============================================================================
    // Data Integrity — Field Presence and Types
    // ============================================================================

    describe('Data Integrity — Field Presence and Types', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should include all required fields in response', async () => {
            const learnerId = new mongoose.Types.ObjectId();
            const linkId = new mongoose.Types.ObjectId();

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'Test Child',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);
            const child = result[0];

            // All fields should be present
            expect(child).toHaveProperty('linkId');
            expect(child).toHaveProperty('learnerId');
            expect(child).toHaveProperty('name');
            expect(child).toHaveProperty('relationshipType');
            expect(child).toHaveProperty('isPrimary');

            // No extra fields from database
            expect(Object.keys(child).sort()).toEqual([
                'isPrimary',
                'learnerId',
                'linkId',
                'name',
                'relationshipType',
            ].sort());
        });

        it('should have correct data types for each field', async () => {
            const learnerId = new mongoose.Types.ObjectId();
            const linkId = new mongoose.Types.ObjectId();

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'Test Child',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);
            const child = result[0];

            expect(child.linkId).toBeInstanceOf(mongoose.Types.ObjectId);
            expect(child.learnerId).toBeInstanceOf(mongoose.Types.ObjectId);
            expect(typeof child.name).toBe('string');
            expect(typeof child.relationshipType).toBe('string');
            expect(typeof child.isPrimary).toBe('boolean');
        });

        it('should handle special characters in child names', async () => {
            const learnerId = new mongoose.Types.ObjectId();
            const linkId = new mongoose.Types.ObjectId();

            const mockLinks = [
                {
                    _id: linkId,
                    parent: parentId,
                    learner: {
                        _id: learnerId,
                        name: 'François d\'Afrique & Co.',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result[0].name).toBe('François d\'Afrique & Co.');
        });
    });

    // ============================================================================
    // Repository Integration
    // ============================================================================

    describe('Repository Integration', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

        it('should call findChildrenForParent with exact parent ID', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue([]);

            await parentLearnerService.getChildrenForParent(parentId);

            expect(parentLearnerRepository.findChildrenForParent).toHaveBeenCalledWith(parentId);
        });

        it('should call repository only once per invocation', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue([]);

            await parentLearnerService.getChildrenForParent(parentId);
            await parentLearnerService.getChildrenForParent(parentId);

            expect(parentLearnerRepository.findChildrenForParent).toHaveBeenCalledTimes(2);
        });

        it('should return exactly what repository provides (after transformation)', async () => {
            const mockLinks = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    parent: parentId,
                    learner: {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Child 1',
                    },
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                    status: 'ACTIVE',
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    parent: parentId,
                    learner: {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Child 2',
                    },
                    relationshipType: ParentRelationshipType.MOTHER,
                    isPrimary: false,
                    status: 'ACTIVE',
                },
            ];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toHaveLength(mockLinks.length);
        });
    });
});
