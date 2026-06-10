/**
 * Parent-Learner Link Repository
 * Data access layer for parent-child relationships
 */

import ParentLearnerLink, { IParentLearnerLink } from '@/models/ParentLearnerLink';
import connectDB from "@/lib/mongodb";
import { LinkStatus } from '@/models/enums';
import mongoose from 'mongoose';

export class ParentLearnerRepository {
    /**
     * Create a new parent-learner [learnerId] (status: PENDING)
     * Called when parent requests to [learnerId] to a child
     */
    async create(data: {
        parent: mongoose.Types.ObjectId;
        learner: mongoose.Types.ObjectId;
        relationshipType: string;
        isPrimary?: boolean;
    }): Promise<IParentLearnerLink> {
        await connectDB();

        const link = new ParentLearnerLink({
            parent: data.parent,
            learner: data.learner,
            relationshipType: data.relationshipType,
            isPrimary: data.isPrimary || false,
            status: LinkStatus.PENDING,
        });

        return await link.save();
    }

    /**
     * Find [learnerId] by ID
     */
    async findById(id: mongoose.Types.ObjectId): Promise<IParentLearnerLink | null> {
        await connectDB();
        return ParentLearnerLink.findById(id);
    }

    /**
     * Find active [learnerId] between parent and learner
     * CRITICAL: Used by ABAC guard (assertAccess)
     */
    async findActiveLink(
        parentId: mongoose.Types.ObjectId,
        learnerId: mongoose.Types.ObjectId
    ): Promise<IParentLearnerLink | null> {
        await connectDB();

        return await ParentLearnerLink.findOne({
            parent: parentId,
            learner: learnerId,
            status: LinkStatus.ACTIVE,
        });
    }

    /**
     * Find all active children for a parent
     * Used by GET /api/parent/children endpoint
     */
    async findChildrenForParent(
        parentId: mongoose.Types.ObjectId
    ): Promise<IParentLearnerLink[]> {
        await connectDB();

        return await ParentLearnerLink.find({
            parent: parentId,
            status: LinkStatus.ACTIVE,
        })
            .populate('learner', 'name email')
            .sort({ isPrimary: -1, createdAt: -1 });
    }

    /**
     * Find all parents linked to a learner
     * Used for parent notifications (SOS, alerts, etc.)
     */
    async findParentsForLearner(
        learnerId: mongoose.Types.ObjectId
    ): Promise<IParentLearnerLink[]> {
        await connectDB();

        return ParentLearnerLink.find({
            learner: learnerId,
            status: LinkStatus.ACTIVE,
        })
            .populate('parent', 'user notificationPreferences')
            .sort({isPrimary: -1});
    }

    /**
     * Find primary parent for a learner
     * Used for school communications
     */
    async findPrimaryParent(
        learnerId: mongoose.Types.ObjectId
    ): Promise<IParentLearnerLink | null> {
        await connectDB();

        return await ParentLearnerLink.findOne({
            learner: learnerId,
            isPrimary: true,
            status: LinkStatus.ACTIVE,
        }).populate('parent');
    }

    /**
     * Find pending links for admin approval
     */
    async findPendingLinks(
        adminSchoolId?: mongoose.Types.ObjectId,
        limit: number = 50
    ): Promise<IParentLearnerLink[]> {
        await connectDB();

        return await ParentLearnerLink.find({
            status: LinkStatus.PENDING,
        })
            .populate('parent', 'user kycLevel')
            .populate('learner', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Approve a pending [learnerId] (status: PENDING → ACTIVE)
     */
    async approveLinkRequest(
        linkId: mongoose.Types.ObjectId,
        adminId: mongoose.Types.ObjectId,
        isPrimary: boolean = false
    ): Promise<IParentLearnerLink | null> {
        await connectDB();

        // If making this primary, unset other primary links for this learner
        const link = await ParentLearnerLink.findById(linkId);
        if (!link) return null;

        if (isPrimary) {
            await ParentLearnerLink.updateMany(
                { learner: link.learner, status: LinkStatus.ACTIVE, isPrimary: true },
                { $set: { isPrimary: false } }
            );
        }

        return await ParentLearnerLink.findByIdAndUpdate(
            linkId,
            {
                $set: {
                    status: LinkStatus.ACTIVE,
                    validatedBy: adminId,
                    validatedAt: new Date(),
                    isPrimary,
                },
            },
            { new: true }
        );
    }

    /**
     * Reject a pending [learnerId]
     */
    async rejectLinkRequest(
        linkId: mongoose.Types.ObjectId,
        adminId: mongoose.Types.ObjectId,
        reason: string
    ): Promise<IParentLearnerLink | null> {
        await connectDB();

        return await ParentLearnerLink.findByIdAndDelete(linkId);
    }

    /**
     * Revoke an active [learnerId] (by parent or admin)
     */
    async revokeLink(
        linkId: mongoose.Types.ObjectId,
        revokedBy: mongoose.Types.ObjectId,
        reason: string
    ): Promise<IParentLearnerLink | null> {
        await connectDB();

        return ParentLearnerLink.findByIdAndUpdate(
            linkId,
            {
                $set: {
                    status: LinkStatus.REVOKED,
                    revokedBy,
                    revokedAt: new Date(),
                    revocationReason: reason,
                },
            },
            {new: true}
        );
    }

    /**
     * Record that parent accessed child's data which will be used later for audit
     */
    async recordAccess(linkId: mongoose.Types.ObjectId): Promise<void> {
        await connectDB();

        await ParentLearnerLink.findByIdAndUpdate(linkId, {
            $set: { lastAccessedAt: new Date() },
        });
    }

    /**
     * Check if parent-learner pair already linked
     */
    async exists(
        parentId: mongoose.Types.ObjectId,
        learnerId: mongoose.Types.ObjectId
    ): Promise<boolean> {
        await connectDB();

        const link = await ParentLearnerLink.findOne({
            parent: parentId,
            learner: learnerId,
        });

        return link !== null;
    }

    /**
     * Count active children for a parent
     */
    async countChildren(parentId: mongoose.Types.ObjectId): Promise<number> {
        await connectDB();

        return await ParentLearnerLink.countDocuments({
            parent: parentId,
            status: LinkStatus.ACTIVE,
        });
    }

    /**
     * Get statistics for admin dashboard
     */
    async getStatistics(): Promise<{
        totalLinks: number;
        activeLinks: number;
        pendingLinks: number;
        revokedLinks: number;
    }> {
        await connectDB();

        const [totalLinks, activeLinks, pendingLinks, revokedLinks] = await Promise.all([
            ParentLearnerLink.countDocuments(),
            ParentLearnerLink.countDocuments({ status: LinkStatus.ACTIVE }),
            ParentLearnerLink.countDocuments({ status: LinkStatus.PENDING }),
            ParentLearnerLink.countDocuments({ status: LinkStatus.REVOKED }),
        ]);

        return { totalLinks, activeLinks, pendingLinks, revokedLinks };
    }

    async findByParentAndLearner(
        parentId: mongoose.Types.ObjectId,
        learnerId: mongoose.Types.ObjectId
    ): Promise<any | null> {
        return await ParentLearnerLink.findOne({
            parent: parentId,
            learner: learnerId,
        });
    }
}

// Export singleton instance
export const parentLearnerRepository = new ParentLearnerRepository();