/**
 * Child Linking Endpoint
 * POST /api/parent/children/[learnerId]/link
 * XKT-003
 */

import { NextRequest } from 'next/server';
import {parentChildController} from "@/lib/controllers/ParentLearnerController";
import { ApiResponse } from '@/lib/utils/apiResponse';
import {ParentError} from "@/lib/errors/core/ParentError";
import { jwtDecode } from 'jwt-decode'; // or your JWT library

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

export const POST = async (
    request: NextRequest,
    { params }: { params: Promise<{ learnerId: string }> }
) => {
    try {

        const { learnerId } = await params;

        // Extract and validate JWT token
        const token = extractToken(request);
        if (!token) {
            return ApiResponse.unauthorized('Missing authentication token');
        }

        // Extract parent ID from token
        const parentId = extractParentIdFromToken(token);
        if (!parentId) {
            return ApiResponse.unauthorized('Invalid token - parent ID not found');
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return ApiResponse.badRequest('Invalid JSON in request body');
        }

        // Call controller to handle link request
        const result = await parentChildController.handleLinkRequest(
            new (require('mongoose').Types.ObjectId)(parentId),
            learnerId,
            body
        );

        // Return success response
        return ApiResponse.created({
            linkId: result.linkId,
            status: result.status,
            message: 'Link request created. Awaiting admin approval.',
        });
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
        console.error('[POST /api/parent/children/:learnerId/link] Error:', error);
        return ApiResponse.internalError('Failed to create link request');
    }
};

/**
 * GET not allowed for this endpoint
 */
export const GET = () => {
    return ApiResponse.badRequest('Method not allowed. Use POST.');
};