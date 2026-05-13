import { NextRequest, NextResponse } from 'next/server';

// CORS Configuration — strict whitelist of exact origins (A-02 fix)
const ALLOWED_ORIGINS = new Set([
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://xkorienta.com',
    'https://www.xkorienta.com',
    'https://gradeforcast.com',
    'https://www.gradeforcast.com',
    'http://localhost:3000',
    'http://localhost:3002',
]);

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];

/**
 * Add CORS headers to a response
 * Only reflects origins present in the exact ALLOWED_ORIGINS set (A-02)
 */
export function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

    return response;
}

/**
 * Handle CORS preflight requests
 */
export function handlePreflight(request: NextRequest): NextResponse {
    const origin = request.headers.get('origin');
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(response, origin);
}

/**
 * CORS middleware wrapper for API routes
 */
export function withCors(handler: (request: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest): Promise<NextResponse> => {
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        // Call the actual handler
        const response = await handler(request);

        // Add CORS headers to the response
        const origin = request.headers.get('origin');
        return addCorsHeaders(response, origin);
    };
}
