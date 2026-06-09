/**
 * Parent Authentication Controller
 * Handles HTTP requests for registration and login
 * Validates input, calls service, formats response
 */

import { parentAuthService } from '@/lib/services/ParentAuthService';
import { registerParentSchema, loginParentSchema } from '@/lib/validation/parentSchemas';
import { ZodError } from 'zod';
import {ParentError} from "@/lib/errors/core/ParentError";
import {KYCLevel} from "@/models/enums";

export class ParentAuthController {
    async handleRegister(body: unknown): Promise<{
        userId: string;
        parentProfileId: string;
        email: string;
    }> {
        // Validate input with Zod
        let validatedData;
        try {
            validatedData = registerParentSchema.parse(body);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_001',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call service to handle registration
        try {
            const result = await parentAuthService.registerParent(validatedData);
            return {
                userId: result.userId.toString(),
                parentProfileId: result.parentProfileId.toString(),
                email: result.email,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Registration failed');
        }
    }

    async handleLogin(body: unknown): Promise<{
        userId: string;
        parentProfileId: string;
        email: string;
        name: string;
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        kycLevel: KYCLevel;
    }> {
        // Validate input with Zod
        let validatedData;
        try {
            validatedData = loginParentSchema.parse(body);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new ParentError({
                    code: 'VAL_002',
                    message: `${error.message}`,
                    httpStatus: 400,
                    severity: 'WARNING',
                    category: 'VALIDATION',
                });
            }
            throw error;
        }

        // Call service to handle login
        try {
            const result = await parentAuthService.loginParent(validatedData);
            return {
                userId: result.userId.toString(),
                parentProfileId: result.parentProfileId.toString(),
                email: result.email,
                name: result.name,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn,
                kycLevel: result.kycLevel,
            };
        } catch (error) {
            if (error instanceof ParentError) {
                throw error;
            }
            throw ParentError.databaseError('Login failed');
        }
    }

    /**
     * Validate if token is still valid
     * Used by frontend to check session expiry
     */
    isTokenValid(token: string): boolean {
        return parentAuthService.verifyToken(token) !== null;
    }

    /**
     * Extract user info from token (without hitting database)
     */
    extractTokenPayload(token: string): {
        userId: string;
        parentProfileId: string;
        email: string;
        kycLevel: number;
    } | null {
        return parentAuthService.verifyToken(token);
    }
}

// Export singleton instance
export const parentAuthController = new ParentAuthController();