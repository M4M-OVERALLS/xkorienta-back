import { NextRequest, NextResponse } from "next/server";

// CORS Configuration — strict whitelist of exact origins (A-02 fix)
// No wildcard subdomain matching — only explicitly listed origins are reflected
const ALLOWED_ORIGINS = new Set([
    'https://xkorienta.com',
    'https://www.xkorienta.com',
    'https://gradeforcast.com',
    'https://www.gradeforcast.com',
    // Dev only — safe because these never match in production
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
]);

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'];

/**
 * Add CORS headers to a response
 * Only reflects origins present in the exact ALLOWED_ORIGINS set (A-02)
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    // If origin is not allowed, no Access-Control-Allow-Origin header is set — browser blocks the request

    response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

    return response;
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        return addCorsHeaders(response, origin);
    }

    // For all other requests, add CORS headers and continue
    const response = NextResponse.next();
    return addCorsHeaders(response, origin);
}

export const config = {
    // Only apply middleware to API routes
    matcher: ['/api/:path*'],
};
