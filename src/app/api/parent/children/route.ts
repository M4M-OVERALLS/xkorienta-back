/**
 * Get Children Endpoint
 * GET /api/parent/children
 * XKT-005 - Parent lists all active child links
 */

import { NextRequest } from 'next/server';
import {parentChildController} from "@/lib/controllers/ParentLearnerController";
import { ApiResponse } from '@/lib/utils/apiResponse';
import {ParentError} from "@/lib/errors/core/ParentError";
import { jwtDecode } from 'jwt-decode';
import mongoose from 'mongoose';

/**
 * Extract parent ID from JWT token
 */
function extractParentIdFromToken(token: string): string | null {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.parentProfileId;
    } catch (error) {
        return null;
    }
}

/**
 * Extract JWT from authorization header
 */
function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

/**
 * @swagger
 * /api/parent/children:
 *   get:
 *     summary: Get Parent's Children
 *     description: |
 *       List all active child-parent links for authenticated parent.
 *       Returns only children the parent is actively linked to (status=ACTIVE).
 *
 *       Results sorted by:
 *       1. isPrimary (primary contact first)
 *       2. createdAt (newest first)
 *     tags:
 *       - Children
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of children
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       linkId:
 *                         type: string
 *                         description: ParentLearnerLink ID (use for dashboard access)
 *                       learnerId:
 *                         type: string
 *                         description: Child's User ID
 *                       name:
 *                         type: string
 *                         example: "Kamga Jean-Claude"
 *                       relationshipType:
 *                         type: string
 *                         enum: [FATHER, MOTHER, GUARDIAN, OTHER]
 *                       isPrimary:
 *                         type: boolean
 *                         description: Is this the primary contact parent?
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       500:
 *         description: Server error
 *
 *     example:
 *       data:
 *         - linkId: "507f1f77bcf86cd799439011"
 *           learnerId: "507f1f77bcf86cd799439012"
 *           name: "Kamga Jean-Claude"
 *           relationshipType: "FATHER"
 *           isPrimary: true
 *         - linkId: "507f1f77bcf86cd799439013"
 *           learnerId: "507f1f77bcf86cd799439014"
 *           name: "Moussa Patricia"
 *           relationshipType: "MOTHER"
 *           isPrimary: false
 */
export const GET = async (request: NextRequest) => {
    try {
        // Extract and validate JWT token
        const token = extractToken(request);
        if (!token) {
            return ApiResponse.unauthorized('Missing authentication token');
        }

        // Extract parent ID from token
        const parentId = extractParentIdFromToken(token);
        if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
            return ApiResponse.unauthorized('Invalid token - parent ID not found');
        }

        // Call controller to get children
        const children = await parentChildController.handleGetChildren(
            new mongoose.Types.ObjectId(parentId)
        );

        // Return success response
        return ApiResponse.list(
            children.map(child => ({
                linkId: child.linkId,
                learnerId: child.learnerId,
                name: child.name,
                relationshipType: child.relationshipType,
                isPrimary: child.isPrimary,
            })),
            {
                total: children.length,
                page: 1,
                limit: 100,
            }
        );
    } catch (error) {
        // Handle known errors
        if (error instanceof ParentError) {
            return ApiResponse.error({
                code: error.code,
                message: error.message,
                httpStatus: error.httpStatus,
                severity: error.severity,
                category: error.category,
            });
        }

        // Handle unexpected errors
        console.error('[GET /api/parent/children] Error:', error);
        return ApiResponse.internalError('Failed to retrieve children list');
    }
};

/**
 * POST not allowed for this endpoint
 */
export const POST = () => {
    return ApiResponse.badRequest('Method not allowed. Use GET to list children, POST to link/unlink.');
};