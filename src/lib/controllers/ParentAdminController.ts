/**
 * Parent Admin Controller
 * Handles HTTP requests for admin operations (link approval, KYC, SOS)
 */

import { parentAdminService } from '@/lib/services/ParentAdminService';
import { parentLearnerService } from '@/lib/services/ParentLearnerService';
import { validateLinkSchema, verifyKYCLevel1Schema, confirmKYCLevel2Schema } from '@/lib/validation/parentSchemas';
import { ZodError } from 'zod';
import { ParentError } from "@/lib/errors/core/ParentError";
import { kycService } from '@/lib/services/KYCService';
import mongoose from 'mongoose';

export class ParentAdminController {

    async handleApproveLinkRequest(
        body: unknown,
        linkId: string,
        adminId: mongoose.Types.ObjectId
    ): Promise<{
        parentId: string;
        learnerId: string;
        status: string;
    }> {
        // Validate input
        let validatedData;
        try {
            validatedData = validateLinkSchema.parse({
                learnerId: linkId,  // Map linkId parameter to learnerId field
                approve: (body as any).approve,
                reason: (body as any).reason,
            });
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_004',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call service to approve
        try {
            const result = await parentAdminService.approveLinkRequest({
                linkId: new mongoose.Types.ObjectId(linkId),
                adminId: adminId,
                isPrimary: (body as any).isPrimary ?? false,
            });

            return {
                parentId: result.parentId.toString(),
                learnerId: result.learnerId.toString(),
                status: result.status,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to approve link');
        }
    }

    /**
     * Admin rejects a pending parent-learner link
     */
    async handleRejectLinkRequest(body: unknown, linkId: string, adminId: mongoose.Types.ObjectId): Promise<void> {
        try {
            await parentAdminService.rejectLinkRequest({
                linkId: new mongoose.Types.ObjectId(linkId),
                adminId,
                reason: (body as any).reason || 'No reason provided',
            });
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to reject link');
        }
    }

    /**
     * Admin revokes an active parent-learner link
     */
    async handleRevokeLink(body: unknown, linkId: string, adminId: mongoose.Types.ObjectId): Promise<void> {
        try {
            await parentAdminService.revokeLink({
                linkId: new mongoose.Types.ObjectId(linkId),
                adminId,
                reason: (body as any).reason || 'Link revoked by administrator',
            });
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to revoke link');
        }
    }

    async handleGetPendingLinks(limit: number = 50): Promise<
        Array<{
            linkId: string;
            parentId: string;
            parentKYCLevel: number;
            learnerId: string;
            relationshipType: string;
            createdAt: string;
        }>
    > {
        try {
            const links = await parentAdminService.getPendingLinkRequests(limit);

            return links.map(link => ({
                linkId: link.linkId.toString(),
                parentId: link.parentId.toString(),
                parentKYCLevel: link.parentKYCLevel,
                learnerId: link.learnerId.toString(),
                relationshipType: link.relationshipType,
                createdAt: link.createdAt.toISOString(),
            }));
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve pending links');
        }
    }

    /**
     * Admin verifies KYC Level 1
     * XKT-007
     */
    async handleVerifyKYCLevel1(body: unknown, parentId: string, adminId: mongoose.Types.ObjectId): Promise<{
        kycLevel: number;
        kycStatus: string;
    }> {
        // Validate input
        let validatedData;
        try {
            validatedData = verifyKYCLevel1Schema.parse({
                parentId,
                approve: (body as any).approve,
                reason: (body as any).reason,
            });
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_005',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call KYC service
        try {
            const result = await kycService.verifyLevel1({
                parentId: new mongoose.Types.ObjectId(parentId),
                adminId,
                approve: validatedData.approve,
                reason: validatedData.reason,
            });

            return {
                kycLevel: result.kycLevel,
                kycStatus: result.kycStatus,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to verify KYC Level 1');
        }
    }

    /**
     * School admin confirms KYC Level 2
     * XKT-008
     */
    async handleConfirmKYCLevel2(body: unknown, parentId: string, adminId: mongoose.Types.ObjectId): Promise<{
        kycLevel: number;
        kycStatus: string;
        dashboardAccessGranted: boolean;
    }> {
        // Validate input
        let validatedData;
        try {
            validatedData = confirmKYCLevel2Schema.parse({
                parentId,
                relationshipNotes: (body as any).relationshipNotes,
            });
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_006',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call KYC service
        try {
            const result = await kycService.confirmLevel2({
                parentId: new mongoose.Types.ObjectId(parentId),
                adminId,
                relationshipNotes: validatedData.relationshipNotes,
            });

            return {
                kycLevel: result.kycLevel,
                kycStatus: result.kycStatus,
                dashboardAccessGranted: result.kycLevel >= 2,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to confirm KYC Level 2');
        }
    }

    /**
     * Get audit trail for a link
     */
    async handleGetLinkAuditTrail(linkId: string): Promise<
        Array<{
            action: string;
            actor: string;
            timestamp: string;
            metadata: any;
        }>
    > {
        try {
            const trail = await parentAdminService.getLinkAuditTrail(
                new mongoose.Types.ObjectId(linkId)
            );

            return trail.map(entry => ({
                action: entry.action,
                actor: entry.actor,
                timestamp: entry.timestamp.toISOString(),
                metadata: entry.metadata,
            }));
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve audit trail');
        }
    }

    /**
     * Get compliance statistics
     */
    async handleGetComplianceStats(): Promise<{
        totalLinks: number;
        activeLinks: number;
        pendingLinks: number;
        revokedLinks: number;
        auditRecords: number;
    }> {
        try {
            return await parentAdminService.getComplianceStatistics();
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve compliance statistics');
        }
    }
}

// Export singleton instance
export const parentAdminController = new ParentAdminController();