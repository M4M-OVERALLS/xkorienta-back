/**
 * API Response Helper
 * Ensures all responses follow the same envelope structure
 * { success, data/error, meta? }
 */

import { NextResponse } from 'next/server';

interface ListMeta {
    total: number;
    page: number;
    limit: number;
}

interface SuccessResponse<T> {
    success: true;
    data: T;
    meta?: ListMeta;
}

interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        severity?: string;
        category?: string;
        timestamp?: string;
    };
}

/**
 * ApiResponse Helper Object
 * Used to format all API responses
 */
export const ApiResponse = {
    /**
     * 200 OK - Generic success response used for GET requests or successful operations with data
     */
    ok<T>(data: T): NextResponse<SuccessResponse<T>> {
        return NextResponse.json(
            { success: true, data },
            { status: 200 }
        );
    },

    /**
     * Use for POST requests that create new resources and it returns 201 if the creation is successful
     */
    created<T>(data: T): NextResponse<SuccessResponse<T>> {
        return NextResponse.json(
            { success: true, data },
            { status: 201 }
        );
    },

    /**
     * 200 OK - List response with pagination metadata used for GET requests that return arrays
     */
    list<T>(
        data: T[],
        meta: ListMeta
    ): NextResponse<SuccessResponse<T[]>> {
        return NextResponse.json(
            { success: true, data, meta },
            { status: 200 }
        );
    },

    /**
     * 204 No Content - Success with no body
     * Use for DELETE or PATCH operations that don't return data
     */
    noContent(): NextResponse {
        return new NextResponse(null, { status: 204 });
    },

    /**
     * 200 OK - Success without specific data (action completed) used for operations that succeed but have no meaningful response
     */
    success(): NextResponse<{ success: true }> {
        return NextResponse.json({ success: true }, { status: 200 });
    },

    /**
     * 400 Bad Request - Client error (validation, malformed request)
     */
    badRequest(message: string): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 400 }
        );
    },

    /**
     * 401 Unauthorized - Missing or invalid authentication
     */
    unauthorized(message: string = 'Unauthorized'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 401 }
        );
    },

    /**
     * 403 Forbidden - Authenticated but not authorized
     */
    forbidden(message: string = 'Forbidden'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 403 }
        );
    },

    /**
     * 404 Not Found
     */
    notFound(message: string = 'Not Found'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 404 }
        );
    },

    /**
     * 409 Conflict - Resource already exists (duplicate)
     */
    conflict(message: string = 'Resource already exists'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'CONFLICT',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 409 }
        );
    },

    /**
     * 422 Unprocessable Entity - Business logic validation failure
     * (Valid format but violates business rules)
     */
    unprocessableEntity(
        message: string
    ): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'UNPROCESSABLE_ENTITY',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 422 }
        );
    },

    /**
     * 429 Too Many Requests - Rate limit exceeded
     */
    tooManyRequests(message: string = 'Too many requests'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'RATE_LIMIT',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 429 }
        );
    },

    /**
     * 500 Internal Server Error
     */
    internalError(message: string = 'Internal server error'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    },

    /**
     * 503 Service Unavailable - External service down
     */
    serviceUnavailable(message: string = 'Service unavailable'): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 503 }
        );
    },

    /**
     * Custom error response with full error object
     * Used when you have a ParentError object
     */
    error(
        errorObject: {
            code: string;
            message: string;
            httpStatus: number;
            severity?: string;
            category?: string;
        }
    ): NextResponse<ErrorResponse> {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: errorObject.code,
                    message: errorObject.message,
                    severity: errorObject.severity,
                    category: errorObject.category,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: errorObject.httpStatus }
        );
    },
};