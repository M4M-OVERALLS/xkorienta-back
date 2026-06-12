/**
 * Parent Login Endpoint
 * POST /api/parent/auth/login
 */

import { NextRequest } from 'next/server';
import { parentAuthController } from '@/lib/controllers/ParentAuthController';
import { ApiResponse } from '@/lib/utils/apiResponse';
import {ParentError} from "@/lib/errors/core/ParentError";

export const POST = async (request: NextRequest) => {
    try {
        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return ApiResponse.badRequest('Invalid JSON in request body');
        }

        // Call controller to handle login
        const result = await parentAuthController.handleLogin(body);

        // Return success response with tokens
        return ApiResponse.ok({
            userId: result.userId,
            parentProfileId: result.parentProfileId,
            email: result.email,
            name: result.name,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
            kycLevel: result.kycLevel,
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
        return ApiResponse.internalError(
            'An unexpected error occurred during login. Please try again later.'
        );
    }
};

/**
 * GET not allowed for this endpoint
 */
export const GET = () => {
    return ApiResponse.badRequest('Method not allowed. Use POST.');
};