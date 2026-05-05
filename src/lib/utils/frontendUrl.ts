/**
 * Utility to determine the frontend URL based on request context
 * Supports multi-domain setup (gradeforcast.com & xkorin.com)
 */

const ALLOWED_DOMAINS = [
    'gradeforcast.com',
    'xkorin.com',
];

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

    // Try to get origin from headers
    const origin = headers.get('origin');
    const referer = headers.get('referer');

    // Check if origin matches one of our allowed domains
    if (origin) {
        const isAllowed = ALLOWED_DOMAINS.some(domain =>
            origin.includes(domain)
        );
        if (isAllowed) {
            return origin;
        }
    }

    // Check referer as fallback
    if (referer) {
        const isAllowed = ALLOWED_DOMAINS.some(domain =>
            referer.includes(domain)
        );
        if (isAllowed) {
            try {
                const url = new URL(referer);
                return `${url.protocol}//${url.host}`;
            } catch {
                // Invalid URL, continue to fallback
            }
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
