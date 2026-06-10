/**
 * Unit Tests for ParentLearnerService (XKT-003)
 */

import { ParentLearnerService } from '@/lib/services/ParentLearnerService';
import { parentLearnerRepository } from '@/lib/repositories/ParentLearnerRepository';
import { ParentError } from '@/lib/errors/core/ParentError';
import mongoose from 'mongoose';
import {ParentRelationshipType, UserRole} from '@/models/enums';
import {parentProfileRepository} from "@/lib/repositories/ParentProfileRepository";
import {userRepository} from "@/lib/repositories/UserRepository";

// Mock connectDB — prevents real Mongoose model code running at import time
jest.mock('@/lib/mongodb', () => ({ __esModule: true, default: jest.fn() }));

// Mock the repository — service only calls repository methods, never models directly
jest.mock('@/lib/repositories/ParentLearnerRepository');
jest.mock('@/lib/repositories/UserRepository');
jest.mock('@/lib/repositories/ParentProfileRepository');

const parentLearnerService = new ParentLearnerService();

describe('XKT-003: ParentLearnerService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // assertAccess() — ABAC Guard
    // ============================================================================

    describe('assertAccess()', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
        const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

        it('should allow access and record it when active link exists', async () => {
            const mockLink = {
                _id: new mongoose.Types.ObjectId(),
                parent: parentId,
                learner: learnerId,
                status: 'ACTIVE',
            };

            //Mock Repositories
            (parentLearnerRepository.findActiveLink as jest.Mock).mockResolvedValue(mockLink);
            (parentLearnerRepository.recordAccess as jest.Mock).mockResolvedValue(undefined);


            const result = await parentLearnerService.assertAccess(parentId, learnerId);

            expect(result).toBeUndefined(); // returns silently on success
            expect(parentLearnerRepository.findActiveLink).toHaveBeenCalledWith(parentId, learnerId);
            expect(parentLearnerRepository.recordAccess).toHaveBeenCalledWith(mockLink._id);
        });

        it('should throw PAR_008 when no active link exists', async () => {
            (parentLearnerRepository.findActiveLink as jest.Mock).mockResolvedValue(null);

            await expect(
                parentLearnerService.assertAccess(parentId, learnerId)
            ).rejects.toMatchObject({ code: 'PAR_008' });
        });

        it('should NOT call recordAccess when link is not found', async () => {
            (parentLearnerRepository.findActiveLink as jest.Mock).mockResolvedValue(null);

            await expect(
                parentLearnerService.assertAccess(parentId, learnerId)
            ).rejects.toThrow();

            expect(parentLearnerRepository.recordAccess).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // linkParentToLearner() — XKT-003
    // ============================================================================

    describe('linkParentToLearner()', () => {
        const parentId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
        const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

        // In your test file - linkParentToLearner tests

        it('should create link with PENDING status', async () => {
            const mockLink = {
                _id: new mongoose.Types.ObjectId(),
                parent: parentId,
                learner: learnerId,
                relationshipType: 'FATHER',
                isPrimary: false,
                status: 'PENDING',
            };

            // Mock user and parent profile
            (userRepository.findById as jest.Mock).mockResolvedValue({
                _id: learnerId,
                role: UserRole.STUDENT,
            });
            (parentProfileRepository.findById as jest.Mock).mockResolvedValue({
                _id: parentId,
            });

            // ✅ Use findByParentAndLearner instead of exists
            (parentLearnerRepository.findByParentAndLearner as jest.Mock).mockResolvedValue(null);
            (parentLearnerRepository.create as jest.Mock).mockResolvedValue(mockLink);

            const result = await parentLearnerService.linkParentToLearner({
                parentId,
                learnerId,
                relationshipType: ParentRelationshipType.FATHER,
            });

            expect(result.linkId).toEqual(mockLink._id);
            expect(result.status).toBe('PENDING');
            expect(parentLearnerRepository.findByParentAndLearner).toHaveBeenCalledWith(parentId, learnerId);
            expect(parentLearnerRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    parent: parentId,
                    learner: learnerId,
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: false,
                })
            );
        });

        it('should throw PAR_011 (alreadyLinked) when link already exists', async () => {
            const mockExistingLink = {
                _id: new mongoose.Types.ObjectId(),
                parent: parentId,
                learner: learnerId,
                status: 'PENDING',
            };

            // Mock user and parent profile
            (userRepository.findById as jest.Mock).mockResolvedValue({
                _id: learnerId,
                role: UserRole.STUDENT,
            });
            (parentProfileRepository.findById as jest.Mock).mockResolvedValue({
                _id: parentId,
            });

            // Return existing link
            (parentLearnerRepository.findByParentAndLearner as jest.Mock).mockResolvedValue(mockExistingLink);

            await expect(
                parentLearnerService.linkParentToLearner({
                    parentId,
                    learnerId,
                    relationshipType: ParentRelationshipType.FATHER,
                })
            ).rejects.toMatchObject({ code: 'PAR_011' });

            expect(parentLearnerRepository.create).not.toHaveBeenCalled();
        });

        it('should always create with isPrimary: false', async () => {
            (userRepository.findById as jest.Mock).mockResolvedValue({
                _id: learnerId,
                role: UserRole.STUDENT,
            });
            (parentProfileRepository.findById as jest.Mock).mockResolvedValue({
                _id: parentId,
            });
            (parentLearnerRepository.findByParentAndLearner as jest.Mock).mockResolvedValue(null);
            (parentLearnerRepository.create as jest.Mock).mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                status: 'PENDING',
                isPrimary: false,
            });

            await parentLearnerService.linkParentToLearner({
                parentId,
                learnerId,
                relationshipType: ParentRelationshipType.MOTHER,
            });

            expect(parentLearnerRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ isPrimary: false })
            );
        });

        it.each([
            ParentRelationshipType.FATHER,
            ParentRelationshipType.MOTHER,
            ParentRelationshipType.GUARDIAN,
            ParentRelationshipType.OTHER,
        ])('should accept relationship type %s', async (type) => {

            (userRepository.findById as jest.Mock).mockResolvedValue({
                _id: learnerId,
                role: UserRole.STUDENT,
            });
            (parentProfileRepository.findById as jest.Mock).mockResolvedValue({
                _id: parentId,
            });
            (parentLearnerRepository.findByParentAndLearner as jest.Mock).mockResolvedValue(null);
            (parentLearnerRepository.create as jest.Mock).mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                status: 'PENDING',
            });

            await parentLearnerService.linkParentToLearner({
                parentId,
                learnerId,
                relationshipType: type,
            });

            expect(parentLearnerRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ relationshipType: type })
            );
        });
    });

    // ============================================================================
    // getChildrenForParent()
    // ============================================================================

    describe('getChildrenForParent()', () => {
        const parentId = new mongoose.Types.ObjectId();

        it('should return mapped list of active children', async () => {
            const learnerId = new mongoose.Types.ObjectId();
            const mockLinks = [{
                _id: new mongoose.Types.ObjectId(),
                parent: parentId,
                learner: { _id: learnerId, name: 'Jean-Claude Kamga' },
                relationshipType: 'FATHER',
                isPrimary: true,
                status: 'ACTIVE',
            }];

            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                learnerId,
                name: 'Jean-Claude Kamga',
                relationshipType: 'FATHER',
                isPrimary: true,
            });
            expect(result[0]).toHaveProperty('linkId');
        });

        it('should return empty array when parent has no children', async () => {
            (parentLearnerRepository.findChildrenForParent as jest.Mock).mockResolvedValue([]);

            const result = await parentLearnerService.getChildrenForParent(parentId);

            expect(result).toEqual([]);
        });
    });

    // ============================================================================
    // getParentsForLearner()
    // ============================================================================

    describe('getParentsForLearner()', () => {
        const learnerId = new mongoose.Types.ObjectId();

        it('should return mapped list of parents with notification preferences', async () => {
            const parentProfileId = new mongoose.Types.ObjectId();
            const mockLinks = [{
                _id: new mongoose.Types.ObjectId(),
                parent: {
                    _id: parentProfileId,
                    notificationPreferences: { sms: true, email: true, push: false },
                },
                learner: learnerId,
                relationshipType: 'MOTHER',
                isPrimary: true,
                status: 'ACTIVE',
            }];

            (parentLearnerRepository.findParentsForLearner as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getParentsForLearner(learnerId);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                parentId: parentProfileId,
                relationshipType: 'MOTHER',
                isPrimary: true,
                notificationPreferences: { sms: true, email: true, push: false },
            });
        });
    });

    // ============================================================================
    // getPrimaryParentForLearner()
    // ============================================================================

    describe('getPrimaryParentForLearner()', () => {
        const learnerId = new mongoose.Types.ObjectId();

        it('should return primary parent when one exists', async () => {
            const parentProfileId = new mongoose.Types.ObjectId();
            const mockLink = {
                _id: new mongoose.Types.ObjectId(),
                parent: { _id: parentProfileId },
                learner: learnerId,
                relationshipType: 'FATHER',
                isPrimary: true,
                status: 'ACTIVE',
            };

            (parentLearnerRepository.findPrimaryParent as jest.Mock).mockResolvedValue(mockLink);

            const result = await parentLearnerService.getPrimaryParentForLearner(learnerId);

            expect(result).toMatchObject({
                parentId: parentProfileId,
                relationshipType: ParentRelationshipType.FATHER,
            });
        });

        it('should return undefined when no primary parent exists', async () => {
            (parentLearnerRepository.findPrimaryParent as jest.Mock).mockResolvedValue(null);

            const result = await parentLearnerService.getPrimaryParentForLearner(learnerId);

            expect(result).toBeUndefined();
        });
    });

    // ============================================================================
    // approveLinkRequest()
    // ============================================================================

    describe('approveLinkRequest()', () => {
        const linkId = new mongoose.Types.ObjectId();
        const adminId = new mongoose.Types.ObjectId();

        it('should return approved link data with ACTIVE status', async () => {
            const mockLink = {
                _id: linkId,
                parent: new mongoose.Types.ObjectId(),
                learner: new mongoose.Types.ObjectId(),
                status: 'ACTIVE',
                validatedBy: adminId,
                validatedAt: new Date(),
                isPrimary: false,
            };

            (parentLearnerRepository.approveLinkRequest as jest.Mock).mockResolvedValue(mockLink);

            const result = await parentLearnerService.approveLinkRequest({ linkId, adminId });

            expect(result.status).toBe('ACTIVE');
            expect(parentLearnerRepository.approveLinkRequest).toHaveBeenCalledWith(
                linkId, adminId, false // isPrimary defaults to false
            );
        });

        it('should throw PAR_008 when link not found', async () => {
            (parentLearnerRepository.approveLinkRequest as jest.Mock).mockResolvedValue(null);

            await expect(
                parentLearnerService.approveLinkRequest({ linkId, adminId })
            ).rejects.toMatchObject({ code: 'PAR_008' });
        });
    });

    // ============================================================================
    // getPendingLinksForAdmin()
    // ============================================================================

    describe('getPendingLinksForAdmin()', () => {
        it('should return mapped pending links with parentKYCLevel', async () => {
            const mockLinks = [{
                _id: new mongoose.Types.ObjectId(),
                parent: { _id: new mongoose.Types.ObjectId(), kycLevel: 1 },
                learner: { _id: new mongoose.Types.ObjectId() },
                relationshipType: 'FATHER',
                createdAt: new Date(),
            }];

            (parentLearnerRepository.findPendingLinks as jest.Mock).mockResolvedValue(mockLinks);

            const result = await parentLearnerService.getPendingLinksForAdmin();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                relationshipType: 'FATHER',
                parentKYCLevel: 1,
            });
            expect(result[0]).toHaveProperty('linkId');
            expect(result[0]).toHaveProperty('parentId');
            expect(result[0]).toHaveProperty('learnerId');
        });

        it('should use default limit of 50', async () => {
            (parentLearnerRepository.findPendingLinks as jest.Mock).mockResolvedValue([]);

            await parentLearnerService.getPendingLinksForAdmin();

            expect(parentLearnerRepository.findPendingLinks).toHaveBeenCalledWith(undefined, 50);
        });

        it('should pass custom limit to repository', async () => {
            (parentLearnerRepository.findPendingLinks as jest.Mock).mockResolvedValue([]);

            await parentLearnerService.getPendingLinksForAdmin(100);

            expect(parentLearnerRepository.findPendingLinks).toHaveBeenCalledWith(undefined, 100);
        });
    });
});