/**
 * Utility to determine the frontend URL based on request context
 * Strict origin matching — no substring/wildcard (A-02 hardening)
 */

const ALLOWED_ORIGINS = new Set([
    'https://xkorienta.com',
    'https://www.xkorienta.com',
    'https://gradeforcast.com',
    'https://www.gradeforcast.com',
    'http://localhost:3000',
]);

/**
 * Get the frontend URL from the request headers
 * Falls back to NEXT_PUBLIC_APP_URL if no valid origin detected
 *
 * @param headers - Request headers (from NextRequest or similar)
 * @returns The appropriate frontend URL
 */
export function getFrontendUrl(headers?: Headers | { get: (key: string) => string | null }): string {
    if (!headers) {
        return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    // Try to get origin from headers — exact match only
    const origin = headers.get('origin');
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        return origin;
    }

    // Check referer as fallback — extract origin and match exactly
    const referer = headers.get('referer');
    if (referer) {
        try {
            const url = new URL(referer);
            const refererOrigin = `${url.protocol}//${url.host}`;
            if (ALLOWED_ORIGINS.has(refererOrigin)) {
                return refererOrigin;
            }
        } catch {
            // Invalid URL, continue to fallback
        }
    }

    // Fallback to environment variable
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Get the frontend domain name (without protocol)
 * @param headers - Request headers
 * @returns Domain name (e.g., 'gradeforcast.com')
 */
export function getFrontendDomain(headers?: Headers | { get: (key: string) => string | null }): string {
    const frontendUrl = getFrontendUrl(headers);

    try {
        const url = new URL(frontendUrl);
        return url.hostname;
    } catch {
        return 'gradeforcast.com'; // Default fallback
    }
}
