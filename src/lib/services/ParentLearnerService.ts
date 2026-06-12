/**
 * Parent-Learner Service
 * This file contains assertAccess() which has the ABAC guard used by ALL dashboard services
 *
 * ABAC = Attribute-Based Access Control
 * Rule: A parent can only access data for learners they are actively linked to
 * This prevents parent A from accessing parent B's child data
 *
 * EVERY dashboard service method MUST call assertAccess() as the FIRST LINE
 */

import { parentLearnerRepository } from '@/lib/repositories/ParentLearnerRepository';
import {ParentError} from "@/lib/errors/core/ParentError";
import {LinkStatus, ParentRelationshipType, UserRole} from '@/models/enums';
import mongoose from 'mongoose';
import User from "@/models/User";
import ParentLearnerLink from "@/models/ParentLearnerLink";
import {userRepository} from "@/lib/repositories/UserRepository";
import {parentProfileRepository} from "@/lib/repositories/ParentProfileRepository";

export class ParentLearnerService {
    /**
     * ABAC GUARD: Assert that parent has access to learner data
     *
     * CRITICAL: Must be called as FIRST LINE in every dashboard service method
     *
     * @throws ParentError.linkNotFound() if:
     *   - Parent not linked to learner
     *   - Link is not ACTIVE (status = PENDING, REVOKED, etc.)
     *   - Learner doesn't exist
     *
     * @returns void (throws on error, returns silently on success)
     */
    async assertAccess(
        parentId: mongoose.Types.ObjectId,
        learnerId: mongoose.Types.ObjectId
    ): Promise<void> {
        // Find active [learnerId]
        const link = await parentLearnerRepository.findActiveLink(parentId, learnerId);

        if (!link) {
            // No active [learnerId] found
            // This throws immediately, preventing any further data access
            throw ParentError.linkNotFound();
        }

        // Link exists and is ACTIVE
        // Record this access for audit trail
        await parentLearnerRepository.recordAccess(link._id);
    }

    /**
     * Request to [learnerId] parent to learner
     * Creates a PENDING [learnerId] that requires admin approval
     */
    async linkParentToLearner(data: {
        parentId: mongoose.Types.ObjectId;
        learnerId: mongoose.Types.ObjectId;
        relationshipType: ParentRelationshipType;
    }): Promise<{
        linkId: mongoose.Types.ObjectId;
        status: string;
    }> {
        // Use repository to check if learner exists
        const learner = await userRepository.findById(data.learnerId.toString());

        if (!learner || learner.role !== UserRole.STUDENT) {
            throw ParentError.learnerNotFound();
        }

        // Use repository to check if parent exists
        const parent = await parentProfileRepository.findById(data.parentId);

        if (!parent) {
            throw ParentError.parentNotFound();
        }

        // Use repository to check for existing link
        const existingLink = await parentLearnerRepository.findByParentAndLearner(
            data.parentId,
            data.learnerId
        );

        //If link exists, throw appropriate error
        if (existingLink) {
            if (existingLink.status === LinkStatus.ACTIVE) {
                throw ParentError.alreadyLinked(); // PAR_009
            }
            if (existingLink.status === LinkStatus.PENDING) {
                throw ParentError.alreadyLinked(); // PAR_011
            }
            // For other statuses (REVOKED, etc.), you might want to allow re-linking
            throw ParentError.alreadyLinked();
        }

        // Create new PENDING [learnerId]
        const link = await parentLearnerRepository.create({
            parent: data.parentId,
            learner: data.learnerId,
            relationshipType: data.relationshipType,
            isPrimary: false,
        });

        return {
            linkId: link._id,
            status: link.status,
        };
    }

    /**
     * Get all active children for a parent
     * Used by GET /api/parent/children endpoint
     *
     * Note: Does NOT call assertAccess (it's a list operation, not for specific child)
     */
    async getChildrenForParent(parentId: mongoose.Types.ObjectId): Promise<
        Array<{
            linkId: mongoose.Types.ObjectId;
            learnerId: mongoose.Types.ObjectId;
            name: string;
            relationshipType: string;
            isPrimary: boolean;
        }>
    > {
        const links = await parentLearnerRepository.findChildrenForParent(parentId);

        return links.map(link => ({
            linkId: link._id,
            learnerId: link.learner._id,
            name: (link.learner as any).name,
            relationshipType: link.relationshipType,
            isPrimary: link.isPrimary,
        }));
    }

    /**
     * Get all parents linked to a learner
     */
    async getParentsForLearner(learnerId: mongoose.Types.ObjectId): Promise<
        Array<{
            parentId: mongoose.Types.ObjectId;
            relationshipType: string;
            isPrimary: boolean;
            notificationPreferences: any;
        }>
    > {
        const links = await parentLearnerRepository.findParentsForLearner(learnerId);

        return links.map(link => ({
            parentId: (link.parent as any)._id,
            relationshipType: link.relationshipType,
            isPrimary: link.isPrimary,
            notificationPreferences: (link.parent as any).notificationPreferences,
        }));
    }

    /**
     * Get primary parent for a learner
     * Used for school communications
     */
    async getPrimaryParentForLearner(learnerId: mongoose.Types.ObjectId): Promise<
        | {
        parentId: mongoose.Types.ObjectId;
        relationshipType: ParentRelationshipType;
    }
        | undefined
    > {
        const link = await parentLearnerRepository.findPrimaryParent(learnerId);

        if (!link) {
            return undefined;
        }

        return {
            parentId: (link.parent as any)._id,
            relationshipType: link.relationshipType,
        };
    }

    /**
     * Approve a pending [learnerId] request (admin only)
     */
    async approveLinkRequest(data: {
        linkId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        isPrimary?: boolean;
    }): Promise<{
        parentId: mongoose.Types.ObjectId;
        learnerId: mongoose.Types.ObjectId;
        status: string;
    }> {
        const link = await parentLearnerRepository.approveLinkRequest(
            data.linkId,
            data.adminId,
            data.isPrimary || false
        );

        if (!link) {
            throw ParentError.linkNotFound();
        }

        return {
            parentId: link.parent as mongoose.Types.ObjectId,
            learnerId: link.learner as mongoose.Types.ObjectId,
            status: link.status,
        };
    }

    /**
     * Reject a pending [learnerId] request (admin only)
     */
    async rejectLinkRequest(data: {
        linkId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        reason: string;
    }): Promise<void> {
        await parentLearnerRepository.rejectLinkRequest(data.linkId, data.adminId, data.reason);
    }

    /**
     * Revoke an active [learnerId]
     * Parent or admin can revoke
     */
    async revokeLink(data: {
        linkId: mongoose.Types.ObjectId;
        revokedBy: mongoose.Types.ObjectId;
        reason: string;
    }): Promise<void> {
        await parentLearnerRepository.revokeLink(
            data.linkId,
            data.revokedBy,
            data.reason
        );
    }

    /**
     * Get pending links for admin approval
     */
    async getPendingLinksForAdmin(limit: number = 50): Promise<
        Array<{
            linkId: mongoose.Types.ObjectId;
            parentId: mongoose.Types.ObjectId;
            learnerId: mongoose.Types.ObjectId;
            relationshipType: string;
            createdAt: Date;
            parentKYCLevel: number;
        }>
    > {
        const links = await parentLearnerRepository.findPendingLinks(undefined, limit);

        return links.map(link => ({
            linkId: link._id,
            parentId: (link.parent as any)._id,
            learnerId: (link.learner as any)._id,
            relationshipType: link.relationshipType,
            createdAt: link.createdAt,
            parentKYCLevel: (link.parent as any).kycLevel,
        }));
    }
}

// Export singleton instance
export const parentLearnerService = new ParentLearnerService();