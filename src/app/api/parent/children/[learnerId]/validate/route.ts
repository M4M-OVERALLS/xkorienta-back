// src/app/api/parent/children/[learnerId]/validate/route.ts

import { NextRequest } from 'next/server';
import { parentAdminController } from '@/lib/controllers/ParentAdminController';
import { ApiResponse } from '@/lib/utils/apiResponse';
import { ParentError } from "@/lib/errors/core/ParentError";
import { jwtDecode } from 'jwt-decode';
import mongoose from 'mongoose';

function extractAdminIdFromToken(token: string): string | null {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.userId;
    } catch (error) {
        return null;
    }
}

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

        const token = extractToken(request);
        if (!token) {
            return ApiResponse.unauthorized('Missing authentication token');
        }

        const adminId = extractAdminIdFromToken(token);
        if (!adminId) {
            return ApiResponse.unauthorized('Invalid token - admin ID not found');
        }

        let body;
        try {
            body = await request.json();
        } catch (error) {
            return ApiResponse.badRequest('Invalid JSON in request body');
        }

        const isApproving = (body as any).approve === true;

        if (isApproving) {
            const result = await parentAdminController.handleApproveLinkRequest(
                body,
                learnerId,
                new mongoose.Types.ObjectId(adminId)
            );

            return ApiResponse.ok({
                parentId: result.parentId,
                learnerId: result.learnerId,
                status: result.status,
                message: 'Link approved.',
            });
        } else {

            const reason = (body as any).reason;
            if (!reason || reason.trim() === '') {
                return ApiResponse.badRequest('Rejection reason is required');
            }

            await parentAdminController.handleRejectLinkRequest(
                body,
                learnerId,
                new mongoose.Types.ObjectId(adminId)
            );

            return ApiResponse.ok({
                message: 'Link request rejected.',
            });
        }
    } catch (error) {
        if (error instanceof ParentError) {
            return ApiResponse.error({
                code: error.code,
                message: error.message,
                httpStatus: error.httpStatus,
                severity: error.severity,
                category: error.category,
            });
        }

        return ApiResponse.internalError('Failed to process link validation');
    }
};

export const GET = () => {
    return ApiResponse.badRequest('Method not allowed. Use POST.');
};