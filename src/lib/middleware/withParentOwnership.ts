/**
 * Parent Ownership Middleware
 * Wraps route handlers to enforce ABAC: parent can only access their own children's data
 * Uses ParentLearnerService.assertAccess() under the hood
 */

import { NextRequest, NextResponse } from 'next/server';
import { parentLearnerService } from '@/lib/services/ParentLearnerService';
import {ParentError} from "@/lib/errors/core/ParentError";
import { ApiResponse } from '@/lib/utils/apiResponse';
import { jwtDecode } from 'jwt-decode'; // or your JWT parsing method
import mongoose from 'mongoose';

/**
 * Extract JWT token from request headers
 */
function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7); // Remove 'Bearer ' prefix
}

/**
 * Extract parent ID from JWT token
 */
function extractParentId(token: string): string | null {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.parentProfileId;
    } catch (error) {
        return null;
    }
}

/**
 * Middleware: Assert parent owns the learner being accessed
 *
 * Usage in route handler:
 *
 * @param handler The actual route handler
 * @returns Wrapped handler that enforces ABAC
 */
export function withParentOwnership(
    handler: (
        request: NextRequest,
        learnerId: mongoose.Types.ObjectId,
        parentId: mongoose.Types.ObjectId
    ) => Promise<NextResponse>
) {
    return async (request: NextRequest, { params }: { params: { learnerId: string } }) => {
        try {
            // Extract and validate learner ID from URL
            const learnerId = params.learnerId;
            if (!learnerId || !mongoose.Types.ObjectId.isValid(learnerId)) {
                return ApiResponse.badRequest('Invalid learner ID');
            }

            // Extract and validate JWT token
            const token = extractToken(request);
            if (!token) {
                return ApiResponse.unauthorized('Missing authentication token');
            }

            // Extract parent ID from token
            const parentId = extractParentId(token);
            if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
                return ApiResponse.unauthorized('Invalid token payload');
            }

            // CRITICAL: Assert parent has access to this learner
            // This call throws ParentError.linkNotFound() if unauthorized
            await parentLearnerService.assertAccess(
                new mongoose.Types.ObjectId(parentId),
                new mongoose.Types.ObjectId(learnerId)
            );

            // Parent is authorized - call the actual handler
            return await handler(
                request,
                new mongoose.Types.ObjectId(learnerId),
                new mongoose.Types.ObjectId(parentId)
            );
        } catch (error) {
            // Handle ABAC violations
            if (error instanceof ParentError) {
                return ApiResponse.error({
                    code: error.code,
                    message: error.message,
                    httpStatus: error.httpStatus,
                    severity: error.severity,
                    category: error.category,
                });
            }

            // Unexpected error
            console.error('[withParentOwnership] Error:', error);
            return ApiResponse.internalError('Authorization check failed');
        }
    };
}

/**
 * Simpler version: Just assert access without wrapping
 * Use this in services/controllers where you already have parent/learner IDs
 *
 * Example:
 *   const isAuthorized = await assertParentOwnsLearner(parentId, learnerId);
 */
export async function assertParentOwnsLearner(
    parentId: mongoose.Types.ObjectId,
    learnerId: mongoose.Types.ObjectId
): Promise<boolean> {
    try {
        await parentLearnerService.assertAccess(parentId, learnerId);
        return true;
    } catch (error) {
        if (error instanceof ParentError) {
            return false;
        }
        throw error;
    }
}

/**
 * Error response helper for ABAC violations
 */
export function parentOwnershipError(): NextResponse {
    return ApiResponse.forbidden(
        'You do not have access to this child\'s information'
    );
}