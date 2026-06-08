/**
 * Environment Configuration with Zod Validation
 * Validates all required secrets at application startup
 * Fails fast if any required env var is missing
 */

import { z } from 'zod';

const envSchema = z.object({
    // this is for the database
    DATABASE_URL: z
        .string()
        .url('DATABASE_URL must be a valid URL')
        .min(1, 'DATABASE_URL is required'),

    // this schema is for validation of NextAuth
    NEXTAUTH_SECRET: z
        .string()
        .min(32, 'NEXTAUTH_SECRET must be at least 32 characters')
        .min(1, 'NEXTAUTH_SECRET is required'),

    NEXTAUTH_URL: z
        .string()
        .url('NEXTAUTH_URL must be a valid URL')
        .min(1, 'NEXTAUTH_URL is required'),

    // Pusher validation
    PUSHER_APP_ID: z
        .string()
        .min(1, 'PUSHER_APP_ID is required'),

    PUSHER_KEY: z
        .string()
        .min(1, 'PUSHER_KEY is required'),

    PUSHER_SECRET: z
        .string()
        .min(1, 'PUSHER_SECRET is required'),

    PUSHER_CLUSTER: z
        .string()
        .min(1, 'PUSHER_CLUSTER is required'),

    // Email (Nodemailer or similar)
    EMAIL_FROM: z
        .string()
        .email('EMAIL_FROM must be a valid email')
        .optional()
        .default('noreply@xkorienta.cm'),

    SMTP_HOST: z
        .string()
        .optional(),

    SMTP_PORT: z
        .string()
        .transform(Number)
        .optional(),

    SMTP_USER: z
        .string()
        .optional(),

    SMTP_PASS: z
        .string()
        .optional(),

    // HuggingFace (for AI/ML features)
    HUGGINGFACE_API_KEY: z
        .string()
        .optional(),

    // Environment
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    // JWT for mobile apps (optional, different from NEXTAUTH_SECRET)
    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters')
        .optional(),

    // Application URL (for links in emails, etc.)
    APP_URL: z
        .string()
        .url('APP_URL must be a valid URL')
        .optional()
        .default('http://localhost:3000'),

    // Logging
    LOG_LEVEL: z
        .enum(['debug', 'info', 'warn', 'error'])
        .optional()
        .default('info'),

    // Feature flags
    ENABLE_SMS_NOTIFICATIONS: z
        .string()
        .transform(v => v === 'true' || v === '1')
        .optional()
        .default(true),

    ENABLE_EMAIL_NOTIFICATIONS: z
        .string()
        .transform(v => v === 'true' || v === '1')
        .optional()
        .default(true),
});

// Parse and validate at startup
const parseEnv = () => {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        console.error('Invalid environment variables:');
        Object.entries(errors).forEach(([key, messages]) => {
            console.error(`  ${key}:`);
            messages?.forEach(msg => console.error(`    - ${msg}`));
        });
        process.exit(1);
    }

    return parsed.data;
};

export const env = parseEnv();

// Type-safe environment object
export type Env = typeof env;

/**
 * Helper to check if running in production
 */
export const isProduction = () => env.NODE_ENV === 'production';

/**
 * Helper to check if running in development
 */
export const isDevelopment = () => env.NODE_ENV === 'development';

/**
 * Helper to check if running in test mode
 */
export const isTest = () => env.NODE_ENV === 'test';