/**
 * Parent Registration Endpoint
 * POST /api/parent/auth/register
 * XKT-001
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

        // Call controller to handle registration
        const result = await parentAuthController.handleRegister(body);

        // Return success response
        return ApiResponse.created(result);
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
        console.error('[POST /api/parent/auth/register] Error:', error);
        return ApiResponse.internalError(
            'An unexpected error occurred during registration. Please try again later.'
        );
    }
};

/**
 * GET not allowed for this endpoint
 */
export const GET = () => {
    return ApiResponse.badRequest('Method not allowed. Use POST.');
};