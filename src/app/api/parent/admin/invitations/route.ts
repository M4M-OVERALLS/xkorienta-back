/**
 * Admin Invitations Endpoint
 * POST /api/parent/admin/invitations
 * Creates invitation tokens that parents use to register
 * Admin-only endpoint (school admins can invite parents)
 */

import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/utils/apiResponse';
import {ParentError} from "@/lib/errors/core/ParentError";
import Invitation from '@/models/Invitation'; // Existing Invitation model
import connectDB from "@/lib/mongodb";
import { randomBytes } from 'crypto';
import { jwtDecode } from 'jwt-decode';
import mongoose from 'mongoose';
import {LinkStatus, UserRole} from "@/models/enums";

/**
 * Generate a unique invitation token
 */
function generateInvitationToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Extract admin ID from JWT token
 */
function extractAdminIdFromToken(token: string): string | null {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.userId;
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

export const POST = async (request: NextRequest) => {
    try {
        await connectDB();

        // Extract and validate JWT token
        const token = extractToken(request);
        if (!token) {
            return ApiResponse.unauthorized('Missing authentication token');
        }

        // Extract admin ID from jwt token
        const adminId = extractAdminIdFromToken(token);
        if (!adminId) {
            return ApiResponse.unauthorized('Invalid jwt token - admin ID not found');
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return ApiResponse.badRequest('Invalid JSON in request body');
        }

        // Validate optional fields
        const learnerId = (body as any).learnerId;
        const classId = (body as any).classId;
        const maxUses = (body as any).maxUses || 1;
        const expiresInDays = (body as any).expiresInDays || 30;

        // Validate expiresInDays
        if (expiresInDays < 1 || expiresInDays > 365) {
            return ApiResponse.badRequest('expiresInDays must be between 1 and 365');
        }

        // Validate maxUses
        if (maxUses < 1 || maxUses > 100) {
            return ApiResponse.badRequest('maxUses must be between 1 and 100');
        }

        // Validate learner ID if provided
        if (learnerId && !mongoose.Types.ObjectId.isValid(learnerId)) {
            return ApiResponse.badRequest('Invalid learnerId format');
        }

        // Validate class ID if provided
        if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
            return ApiResponse.badRequest('Invalid classId format');
        }

        // Generate unique invitation token
        const invitationToken = generateInvitationToken();

        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Create invitation record
        const invitation = new Invitation({
            token: invitationToken,
            role: UserRole.PARENT,
            status: LinkStatus.PENDING,
            maxUses,
            usageCount: 0,
            learnerId: learnerId ? new mongoose.Types.ObjectId(learnerId) : undefined,
            classId: classId ? new mongoose.Types.ObjectId(classId) : undefined,
            createdBy: new mongoose.Types.ObjectId(adminId),
            expiresAt,
        });

        await invitation.save();

        // Return success response
        return ApiResponse.created({
            invitationToken,
            expiresAt: expiresAt.toISOString(),
            expiresInDays,
            createdBy: adminId,
            message: 'Invitation created. Share this token with the parent to register.',
            instructions: [
                'Share the invitationToken with the parent',
                'Parent visits: https://xkorienta.cm/register',
                'Parent enters token and creates account',
                'Parent completes KYC verification',
            ],
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
        console.error('[POST /api/parent/admin/invitations] Error:', error);
        return ApiResponse.internalError('Failed to create invitation');
    }
};

/**
 * GET not allowed for this endpoint
 */
export const GET = () => {
    return ApiResponse.badRequest('Method not allowed. Use POST.');
};