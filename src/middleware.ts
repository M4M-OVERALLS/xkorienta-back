import { NextRequest, NextResponse } from "next/server";

// CORS Configuration - Production domains + localhost for development
const ALLOWED_ORIGINS = [
    'https://xkorienta.com',
    'https://www.xkorienta.com',
    'https://gradeforcast.com',
    'https://www.gradeforcast.com',
    'https://xkorin.com',
    'https://www.xkorin.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
];

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'];

/**
 * Add CORS headers to a response
 * Accepts requests from gradeforcast.com, xkorin.com and localhost
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
    // Check if origin matches any allowed domain (including subdomains)
    const isAllowed = origin && (
        ALLOWED_ORIGINS.includes(origin) ||
        origin.endsWith('.xkorienta.com') ||
        origin.endsWith('.gradeforcast.com') ||
        origin.endsWith('.xkorin.com')
    );

    const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
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
