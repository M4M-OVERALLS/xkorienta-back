/**
 * Parent Admin Service
 * Business logic for admin operations: link approval, KYC verification, SOS handling
 */

import { parentLearnerRepository } from '@/lib/repositories/ParentLearnerRepository';
import { auditLogRepository } from '@/lib/repositories/AuditLogRepository';
import {ParentError} from "@/lib/errors/core/ParentError";
import { AuditAction } from '@/models/enums';
import mongoose from 'mongoose';

export class ParentAdminService {
    /**
     * Admin approves a pending parent-learner link request
     * XKT-004
     *
     * Steps:
     * 1. Validate link exists and is PENDING
     * 2. Update link status to ACTIVE
     * 3. Log to AuditLog
     * 4. Return approval confirmation
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
        // Approve the link
        const approvedLink = await parentLearnerRepository.approveLinkRequest(
            data.linkId,
            data.adminId,
            data.isPrimary || false
        );

        if (!approvedLink) {
            throw ParentError.linkNotFound();
        }

        // Log to audit trail
        await auditLogRepository.log({
            actor: data.adminId,
            action: AuditAction.LINK_APPROVED,
            targetId: data.linkId,
            targetType: 'ParentLearnerLink',
            metadata: {
                parentId: approvedLink.parent.toString(),
                learnerId: approvedLink.learner.toString(),
                relationshipType: approvedLink.relationshipType,
                isPrimary: data.isPrimary || false,
            },
        });

        return {
            parentId: approvedLink.parent as mongoose.Types.ObjectId,
            learnerId: approvedLink.learner as mongoose.Types.ObjectId,
            status: approvedLink.status,
        };
    }

    /**
     * Admin rejects a pending parent-learner link request
     */
    async rejectLinkRequest(data: {
        linkId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        reason: string;
    }): Promise<void> {
        // Get link before deletion (for audit)
        const link = await parentLearnerRepository.findById(data.linkId);
        if (!link) {
            throw ParentError.linkNotFound();
        }

        // Delete the pending link
        await parentLearnerRepository.rejectLinkRequest(
            data.linkId,
            data.adminId,
            data.reason
        );

        // Log rejection
        await auditLogRepository.log({
            actor: data.adminId,
            action: AuditAction.LINK_CREATED, // Use LINK_CREATED as base, metadata shows rejection
            targetId: data.linkId,
            targetType: 'ParentLearnerLink',
            metadata: {
                status: 'REJECTED',
                rejectionReason: data.reason,
                parentId: link.parent.toString(),
                learnerId: link.learner.toString(),
            },
        });
    }

    /**
     * Admin revokes an active parent-learner link
     * Can revoke due to: relationship change, parent request, school policy, etc.
     */
    async revokeLink(data: {
        linkId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        reason: string;
    }): Promise<void> {
        // Get link before revocation
        const link = await parentLearnerRepository.findById(data.linkId);
        if (!link) {
            throw ParentError.linkNotFound();
        }

        // Revoke the link
        await parentLearnerRepository.revokeLink(data.linkId, data.adminId, data.reason);

        // Log revocation
        await auditLogRepository.log({
            actor: data.adminId,
            action: AuditAction.LINK_REVOKED,
            targetId: data.linkId,
            targetType: 'ParentLearnerLink',
            metadata: {
                revocationReason: data.reason,
                parentId: link.parent.toString(),
                learnerId: link.learner.toString(),
            },
        });
    }

    /**
     * Get pending links requiring admin approval
     */
    async getPendingLinkRequests(limit: number = 50): Promise<
        Array<{
            linkId: mongoose.Types.ObjectId;
            parentId: mongoose.Types.ObjectId;
            parentKYCLevel: number;
            learnerId: mongoose.Types.ObjectId;
            relationshipType: string;
            createdAt: Date;
        }>
    > {
        const pendingLinks = await parentLearnerRepository.findPendingLinks(undefined, limit);

        return pendingLinks.map(link => ({
            linkId: link._id,
            parentId: (link.parent as any)._id,
            parentKYCLevel: (link.parent as any).kycLevel,
            learnerId: (link.learner as any)._id,
            relationshipType: link.relationshipType,
            createdAt: link.createdAt,
        }));
    }

    /**
     * Get audit trail for a specific link
     * Used for admin investigation
     */
    async getLinkAuditTrail(linkId: mongoose.Types.ObjectId): Promise<
        Array<{
            action: string;
            actor: string;
            timestamp: Date;
            metadata: any;
        }>
    > {
        const logs = await auditLogRepository.getLinkAuditTrail(linkId);

        return logs.map(log => ({
            action: log.action,
            actor: log.actor.toString(),
            timestamp: log.createdAt,
            metadata: log.metadata,
        }));
    }

    /**
     * Get compliance statistics
     * Used for admin dashboard and reporting
     */
    async getComplianceStatistics(): Promise<{
        totalLinks: number;
        activeLinks: number;
        pendingLinks: number;
        revokedLinks: number;
        auditRecords: number;
    }> {
        const stats = await parentLearnerRepository.getStatistics();

        return {
            totalLinks: stats.totalLinks,
            activeLinks: stats.activeLinks,
            pendingLinks: stats.pendingLinks,
            revokedLinks: stats.revokedLinks,
            auditRecords: 0, // TODO: Get from audit table
        };
    }

    /**
     * Verify audit log integrity
     * Check if any records have been tampered with
     */
    async verifyAuditIntegrity(): Promise<{
        valid: number;
        corrupted: number;
        corruptedIds: string[];
    }> {
        const result = await auditLogRepository.verifyIntegrity(100);

        return {
            valid: result.valid,
            corrupted: result.corrupted,
            corruptedIds: result.corruptedIds,
        };
    }

    /**
     * Export parent data for GDPR request
     */
    async exportParentData(parentId: mongoose.Types.ObjectId): Promise<{
        auditTrail: any[];
        exportedAt: Date;
    }> {
        return await auditLogRepository.exportParentData(parentId);
    }
}

// Export singleton instance
export const parentAdminService = new ParentAdminService();