/**
 * Parent KYC Controller
 * Handles HTTP requests for KYC verification (L1 document upload, L2 confirmation)
 */

import { kycService } from '@/lib/services/KYCService';
import { submitKYCLevel1Schema } from '@/lib/validation/parentSchemas';
import { ZodError } from 'zod';
import {ParentError} from "@/lib/errors/core/ParentError";
import mongoose from 'mongoose';

export class ParentKYCController {

    async handleSubmitLevel1(
        parentId: mongoose.Types.ObjectId,
        body: unknown
    ): Promise<{
        kycLevel: number;
        kycStatus: string;
        message: string;
    }> {
        // Validate input with Zod
        let validatedData;
        try {
            validatedData = submitKYCLevel1Schema.parse(body);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_007',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // TODO: Upload file to S3/MinIO
        // For now, just store the base64 in database (not recommended for production)
        const documentUrl = `s3://xkorienta-kyc/${parentId}/${validatedData.fileName}`;

        // TODO: Extract ID number from document using OCR
        const nationalId = undefined;

        // Call service to submit KYC
        try {
            const result = await kycService.submitLevel1({
                parentId,
                documentType: validatedData.documentType,
                nationalId,
                documentUrl,
            });

            return {
                kycLevel: result.kycLevel,
                kycStatus: result.kycStatus,
                message:
                    'Document submitted successfully. Admin will review within 24-48 hours.',
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to submit KYC document');
        }
    }

    /**
     * Get KYC status for parent
     * Parent checks their verification progress
     *
     * @swagger
     * /api/parent/kyc/status:
     *   get:
     *     summary: Get KYC Status
     *     description: Check current KYC verification level and next steps
     *     tags:
     *       - KYC
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: KYC status
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     kycLevel:
     *                       type: number
     *                       enum: [0, 1, 2]
     *                     kycStatus:
     *                       type: string
     *                     canAccessDashboard:
     *                       type: boolean
     *                     canRequestChildLink:
     *                       type: boolean
     *                     nextSteps:
     *                       type: array
     *                       items:
     *                         type: string
     */
    async handleGetKYCStatus(parentId: mongoose.Types.ObjectId): Promise<{
        kycLevel: number;
        kycStatus: string;
        canAccessDashboard: boolean;
        canRequestChildLink: boolean;
        nextSteps: string[];
    }> {
        try {
            const status = await kycService.getKYCStatus(parentId);

            return {
                kycLevel: status.kycLevel,
                kycStatus: status.kycStatus,
                canAccessDashboard: status.canAccessDashboard,
                canRequestChildLink: status.canRequestChildLink,
                nextSteps: status.nextSteps,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to retrieve KYC status');
        }
    }

    /**
     * Get pending KYC submissions for admin (admin only)
     */
    async handleGetPendingSubmissions(limit: number = 50): Promise<
        Array<{
            parentId: string;
            email: string;
            documentType: string;
            submittedAt: string;
            kycStatus: string;
        }>
    > {
        try {
            const pending = await kycService.getPendingSubmissions(limit);

            return pending.map(item => ({
                parentId: item.parentId.toString(),
                email: item.email,
                documentType: item.documentType,
                submittedAt: item.submittedAt.toISOString(),
                kycStatus: item.kycStatus,
            }));
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve pending submissions');
        }
    }
}

// Export singleton instance
export const parentKYCController = new ParentKYCController();