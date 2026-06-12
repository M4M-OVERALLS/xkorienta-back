/**
 * KYC Service
 * Handles Know Your Customer (KYC) verification logic
 * Two-level verification: L1=identity, L2=school relationship confirmation
 * XKT-006, 007, 008
 */

import { parentProfileRepository } from '@/lib/repositories/ParentProfileRepository';
import { auditLogRepository } from '@/lib/repositories/AuditLogRepository';
import {ParentError} from "@/lib/errors/core/ParentError";
import { KYCLevel, KYCStatus, AuditAction } from '@/models/enums';
import mongoose from 'mongoose';

export class KYCService {
    /**
     * Submit KYC Level 1 (identity document upload)
     * Parent uploads national ID, passport, or driver's license
     * XKT-006
     *
     * Steps:
     * 1. Validate file format and size
     * 2. Extract ID number (TODO: OCR)
     * 3. Store in S3/MinIO
     * 4. Create KYC record (status: SUBMITTED)
     * 5. Log to audit trail
     */
    async submitLevel1(data: {
        parentId: mongoose.Types.ObjectId;
        documentType: string; // NATIONAL_ID, PASSPORT, DRIVER_LICENSE
        nationalId?: string; // Extracted from document
        documentUrl: string; // S3/MinIO URL
    }): Promise<{
        kycLevel: KYCLevel;
        kycStatus: KYCStatus;
    }> {
        // Update parent profile with document
        const updatedProfile = await parentProfileRepository.updateKYCLevel1(
            data.parentId,
            {
                nationalId: data.nationalId,
                nationalIdType: data.documentType,
                nationalIdDocumentUrl: data.documentUrl,
                kycStatus: KYCStatus.SUBMITTED,
            }
        );

        if (!updatedProfile) {
            throw ParentError.parentNotFound();
        }

        // Log to audit trail
        await auditLogRepository.log({
            actor: data.parentId,
            action: AuditAction.KYC_L1_SUBMITTED,
            targetId: data.parentId,
            targetType: 'ParentProfile',
            metadata: {
                documentType: data.documentType,
                documentUrl: data.documentUrl,
            },
        });

        return {
            kycLevel: updatedProfile.kycLevel,
            kycStatus: updatedProfile.kycStatus,
        };
    }

    /**
     * Verify KYC Level 1 (admin review of document)
     * Admin confirms that document is valid and readable
     * XKT-007
     *
     * Steps:
     * 1. Retrieve parent profile
     * 2. Check document is SUBMITTED
     * 3. Approve or reject
     * 4. Update status
     * 5. Log to audit trail
     * 6. Send notification to parent
     */
    async verifyLevel1(data: {
        parentId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        approve: boolean;
        reason?: string;
    }): Promise<{
        kycLevel: KYCLevel;
        kycStatus: KYCStatus;
        canRequestChildLink: boolean;
    }> {
        // Verify or reject
        const updatedProfile = await parentProfileRepository.verifyKYCLevel1(
            data.parentId,
            data.adminId,
            data.approve,
            data.reason
        );

        if (!updatedProfile) {
            throw ParentError.parentNotFound();
        }

        // Log to audit trail
        const action = data.approve ? AuditAction.KYC_L1_VERIFIED : AuditAction.KYC_L1_REJECTED;
        await auditLogRepository.log({
            actor: data.adminId,
            action,
            targetId: data.parentId,
            targetType: 'ParentProfile',
            metadata: {
                approved: data.approve,
                reason: data.reason,
                nationalIdVerified: data.approve,
            },
        });

        // TODO: Send email notification to parent

        return {
            kycLevel: updatedProfile.kycLevel,
            kycStatus: updatedProfile.kycStatus,
            canRequestChildLink: updatedProfile.canRequestChildLink(),
        };
    }

    /**
     * Confirm KYC Level 2 (school admin relationship verification)
     * School admin confirms parent-child relationship (phone call, document check, etc.)
     * This grants dashboard access
     * XKT-008
     *
     * Steps:
     * 1. Validate parent is KYC L1 verified
     * 2. Mark as KYC L2 confirmed
     * 3. Enable dashboard access (isActive=true)
     * 4. Activate any pending parent-learner links
     * 5. Log to audit trail
     * 6. Send notification to parent
     */
    async confirmLevel2(data: {
        parentId: mongoose.Types.ObjectId;
        adminId: mongoose.Types.ObjectId;
        relationshipNotes?: string;
    }): Promise<{
        kycLevel: KYCLevel;
        kycStatus: KYCStatus;
        dashboardAccessGranted: boolean;
    }> {
        // Check parent is KYC L1 verified
        const profile = await parentProfileRepository.findById(data.parentId);
        if (!profile) {
            throw ParentError.parentNotFound();
        }

        if (profile.kycLevel < KYCLevel.LEVEL_1) {
            throw ParentError.kycL1NotVerified();
        }

        // Confirm Level 2
        const updatedProfile = await parentProfileRepository.confirmKYCLevel2(
            data.parentId,
            data.adminId
        );

        if (!updatedProfile) {
            throw ParentError.parentNotFound();
        }

        // Log to audit trail
        await auditLogRepository.log({
            actor: data.adminId,
            action: AuditAction.KYC_L2_VERIFIED,
            targetId: data.parentId,
            targetType: 'ParentProfile',
            metadata: {
                relationshipNotes: data.relationshipNotes,
                dashboardAccessGranted: true,
            },
        });

        // TODO: Send email notification to parent
        // TODO: Send notification about pending parent-learner link activation

        return {
            kycLevel: updatedProfile.kycLevel,
            kycStatus: updatedProfile.kycStatus,
            dashboardAccessGranted: updatedProfile.canAccessDashboard(),
        };
    }

    /**
     * Get KYC status for a parent
     * Used by parent to check verification progress
     */
    async getKYCStatus(parentId: mongoose.Types.ObjectId): Promise<{
        kycLevel: KYCLevel;
        kycStatus: KYCStatus;
        canAccessDashboard: boolean;
        canRequestChildLink: boolean;
        nextSteps: string[];
    }> {
        const status = await parentProfileRepository.getKYCStatus(parentId);

        if (!status) {
            throw ParentError.parentNotFound();
        }

        // Determine next steps based on current level
        const nextSteps: string[] = [];
        if (status.kycLevel === KYCLevel.NONE) {
            nextSteps.push('Upload your identity document (national ID, passport, or driver license)');
        } else if (status.kycLevel === KYCLevel.LEVEL_1) {
            if (status.kycStatus === KYCStatus.VERIFIED) {
                nextSteps.push('School will confirm your identity');
            } else {
                nextSteps.push('Waiting for admin to verify your document');
            }
        } else if (status.kycLevel === KYCLevel.LEVEL_2) {
            nextSteps.push('KYC verified! You can now access the parent dashboard');
        }

        return {
            kycLevel: status.kycLevel,
            kycStatus: status.kycStatus,
            canAccessDashboard: status.canAccessDashboard,
            canRequestChildLink: status.kycLevel >= KYCLevel.LEVEL_1,
            nextSteps,
        };
    }

    /**
     * Get all pending KYC submissions for admin review
     */
    async getPendingSubmissions(limit: number = 50): Promise<
        Array<{
            parentId: mongoose.Types.ObjectId;
            email: string;
            documentType: string;
            submittedAt: Date;
            kycStatus: KYCStatus;
        }>
    > {
        const pending = await parentProfileRepository.findPendingKYC(limit);

        return pending.map(profile => ({
            parentId: profile._id,
            email: (profile.user as any).email,
            documentType: profile.nationalIdType || 'UNKNOWN',
            submittedAt: profile.documentUploadedAt || new Date(),
            kycStatus: profile.kycStatus,
        }));
    }

    /**
     * Reject KYC and allow resubmission
     */
    async rejectAndAllowResubmit(
        parentId: mongoose.Types.ObjectId,
        adminId: mongoose.Types.ObjectId,
        reason: string
    ): Promise<void> {
        const profile = await parentProfileRepository.findById(parentId);
        if (!profile) {
            throw ParentError.parentNotFound();
        }

        // Reset to Level 0 so parent can resubmit
        await parentProfileRepository.verifyKYCLevel1(parentId, adminId, false, reason);

        // Log rejection
        await auditLogRepository.log({
            actor: adminId,
            action: AuditAction.KYC_L1_REJECTED,
            targetId: parentId,
            targetType: 'ParentProfile',
            metadata: {
                reason,
                allowResubmission: true,
            },
        });

        // TODO: Send notification to parent with rejection reason
    }
}

// Export singleton instance
export const kycService = new KYCService();