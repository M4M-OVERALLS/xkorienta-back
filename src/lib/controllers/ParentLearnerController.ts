import {parentLearnerService} from "@/lib/services/ParentLearnerService";
import {ParentError} from "@/lib/errors/core/ParentError";
import zodError, {ZodError} from "zod";
import mongoose from 'mongoose';

/**
 * Parent Child Controller
 * Handles HTTP requests for child linking (XKT-003, 005)
 */
import { linkParentToLearnerSchema } from '@/lib/validation/parentSchemas';
import {ParentRelationshipType} from "@/models/enums";


export class ParentChildController {
    async handleLinkRequest(
        parentId: mongoose.Types.ObjectId,
        learnerId: string,
        body: unknown
    ): Promise<{
        linkId: string;
        status: string;
    }> {
        // Validate learner ID format
        if (!mongoose.Types.ObjectId.isValid(learnerId)) {
            throw ParentError.learnerNotFound();
        }

        // Validate request body
        let validatedData;
        try {
            validatedData = linkParentToLearnerSchema.parse({
                learnerId,
                relationshipType: (body as any).relationshipType,
                isPrimary: (body as any).isPrimary,
            });
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_003',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call service to create [learnerId]
        try {
            const result = await parentLearnerService.linkParentToLearner({
                parentId,
                learnerId: new mongoose.Types.ObjectId(learnerId),
                relationshipType: validatedData.relationshipType as ParentRelationshipType,
            });

            return {
                linkId: result.linkId.toString(),
                status: result.status,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Failed to create [learnerId]');
        }
    }

    async handleGetChildren(parentId: mongoose.Types.ObjectId): Promise<
        Array<{
            linkId: string;
            learnerId: string;
            name: string;
            relationshipType: string;
            isPrimary: boolean;
        }>
    > {
        try {
            const children = await parentLearnerService.getChildrenForParent(parentId);

            return children.map(child => ({
                linkId: child.linkId.toString(),
                learnerId: child.learnerId.toString(),
                name: child.name,
                relationshipType: child.relationshipType,
                isPrimary: child.isPrimary,
            }));
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve children');
        }
    }

    /**
     * Get pending links for admin (admin only endpoint)
     */
    async handleGetPendingLinksForAdmin(limit: number = 50): Promise<
        Array<{
            linkId: string;
            parentId: string;
            learnerId: string;
            relationshipType: string;
            createdAt: string;
            parentKYCLevel: number;
        }>
    > {
        try {
            const links = await parentLearnerService.getPendingLinksForAdmin(limit);

            return links.map(link => ({
                linkId: link.linkId.toString(),
                parentId: link.parentId.toString(),
                learnerId: link.learnerId.toString(),
                relationshipType: link.relationshipType,
                createdAt: link.createdAt.toISOString(),
                parentKYCLevel: link.parentKYCLevel,
            }));
        } catch (error) {
            throw ParentError.databaseError('Failed to retrieve pending links');
        }
    }
}

// Export singleton instance
export const parentChildController = new ParentChildController();