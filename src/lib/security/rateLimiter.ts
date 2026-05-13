import { NextResponse } from 'next/server'

interface RateLimitStore {
    [key: string]: {
        count: number
        resetTime: number
    }
}

const store: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    Object.keys(store).forEach(key => {
        if (store[key].resetTime < now) {
            delete store[key]
        }
    })
}, 5 * 60 * 1000)

interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Maximum requests per window
}

/**
 * Rate limiter for API routes
 */
export function rateLimit(config: RateLimitConfig) {
    return (identifier: string): { success: boolean; limit: number; remaining: number; resetTime: number } => {
        const now = Date.now()
        const key = `ratelimit:${identifier}`

        if (!store[key] || store[key].resetTime < now) {
            store[key] = {
                count: 0,
                resetTime: now + config.windowMs
            }
        }

        store[key].count++

        const success = store[key].count <= config.maxRequests
        const remaining = Math.max(0, config.maxRequests - store[key].count)

        return {
            success,
            limit: config.maxRequests,
            remaining,
            resetTime: store[key].resetTime
        }
    }
}

/**
 * Rate limiter for login attempts - strict
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 attempts
})

/**
 * Rate limiter for API routes - moderate
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute
})

/**
 * Rate limiter for exam submission - prevent spam
 */
export const examSubmissionLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    maxRequests: 1 // 1 submission per 10 seconds
})

/**
 * Rate limiter for registration - prevent bot registration
 */
export const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3 // 3 registrations per hour per IP
})

/**
 * Rate limiter for late-code generation — 20 per hour per user (A-17)
 */
export const lateCodeGenerateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20 // 20 generations per hour per user
})


/**
 * Check rate limit without incrementing — use with rateLimitConsume for fail-only counting
 */
export function rateLimitCheck(config: RateLimitConfig, identifier: string): { allowed: boolean; resetTime: number } {
    const now = Date.now()
    const key = `ratelimit:${identifier}`

    if (!store[key] || store[key].resetTime < now) {
        return { allowed: true, resetTime: now + config.windowMs }
    }

    return {
        allowed: store[key].count < config.maxRequests,
        resetTime: store[key].resetTime
    }
}

/**
 * Consume one rate limit token — call only on failure
 */
export function rateLimitConsume(config: RateLimitConfig, identifier: string): void {
    const now = Date.now()
    const key = `ratelimit:${identifier}`

    if (!store[key] || store[key].resetTime < now) {
        store[key] = {
            count: 0,
            resetTime: now + config.windowMs
        }
    }

    store[key].count++
}

/**
 * Helper to get client identifier (IP address)
 */
export function getClientIdentifier(request: Request): string {
    // Get IP from headers (works with proxies)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] :
               request.headers.get('x-real-ip') ||
               'unknown'

    return ip
}

/**
 * Helper to create rate limit response
 */
export function createRateLimitResponse(resetTime: number) {
    const resetDate = new Date(resetTime)
    return NextResponse.json(
        {
            message: 'Too many requests. Please try again later.',
            retryAfter: resetDate.toISOString()
        },
        {
            status: 429,
            headers: {
                'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
                'X-RateLimit-Reset': resetDate.toISOString()
            }
        }
    )
}
