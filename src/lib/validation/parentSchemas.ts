/**
 * Parent Module Validation Schemas
 * Zod schemas for all request bodies and query parameters
 * Controllers make use of this to validate input before sending to services
 */

import {z} from 'zod';
import {isValidObjectId} from 'mongoose';

// REUSABLE COMPONENTS

const mongoIdSchema = z
    .string()
    .refine(isValidObjectId, {message: 'Invalid ID format'});

const emailSchema = z
    .string()
    .email('Invalid email address')
    .toLowerCase();

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters');

const phoneSchema = z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number format')
    .optional();

const nameSchema = z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim();


// AUTHENTICATION SCHEMAS

export const registerParentSchema = z.object({
    invitationToken: z
        .string()
        .min(2, 'Invalid invitation token')
        .max(128),
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    language: z
        .enum(['fr', 'en'])
        .default('fr'),
});

export type RegisterParentInput = z.infer<typeof registerParentSchema>;

export const loginParentSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
});

export type LoginParentInput = z.infer<typeof loginParentSchema>;


// EXPORT TYPES FOR USE IN CONTROLLERS

export type ParentValidationSchemas = {
    registerParent: typeof registerParentSchema;
    loginParent: typeof loginParentSchema;
};