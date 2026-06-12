/**
 * Parent Module Validation Schemas
 * Zod schemas for all request bodies and query parameters
 * Controllers make use of this to validate input before sending to services
 */

import {z} from 'zod';
import {isValidObjectId} from 'mongoose';
import {ParentRelationshipType} from "@/models/enums";

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


// ============================================================================
// CHILD LINKING SCHEMAS
// ============================================================================

export const linkParentToLearnerSchema = z.object({
    learnerId: mongoIdSchema,
    relationshipType: z.nativeEnum(ParentRelationshipType),
    isPrimary: z.boolean().optional().default(true),
});

export type LinkParentToLearnerInput = z.infer<typeof linkParentToLearnerSchema>;

export const validateLinkSchema = z.object({
    learnerId: mongoIdSchema,
    approve: z.boolean(),
    reason: z.string().optional(),
});

// ============================================================================
// KYC VERIFICATION SCHEMAS (XKT-006, 007, 008)
// ============================================================================

export const submitKYCLevel1Schema = z.object({
    documentType: z.enum(['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE']),
    fileName: z.string(),
    fileSize: z.number().max(5 * 1024 * 1024, 'File must be less than 5MB'),
    fileMimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    fileBase64: z.string(),
});

export type SubmitKYCLevel1Input = z.infer<typeof submitKYCLevel1Schema>;

export const verifyKYCLevel1Schema = z.object({
    parentId: mongoIdSchema,
    approve: z.boolean(),
    reason: z.string().optional(),
});

export type VerifyKYCLevel1Input = z.infer<typeof verifyKYCLevel1Schema>;


export const confirmKYCLevel2Schema = z.object({
    parentId: mongoIdSchema,
    relationshipNotes: z.string().optional(),
});

export type ConfirmKYCLevel2Input = z.infer<typeof confirmKYCLevel2Schema>;


export type ValidateLinkInput = z.infer<typeof validateLinkSchema>;

// EXPORT TYPES FOR USE IN CONTROLLERS

export type ParentValidationSchemas = {
    registerParent: typeof registerParentSchema;
    loginParent: typeof loginParentSchema;
};