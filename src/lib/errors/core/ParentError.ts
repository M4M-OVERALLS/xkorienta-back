/**
 * Parent Module Error Class
 * Centralized error factory for Parent domain
 */

import { BaseApplicationError } from "@/lib/errors";
import { ErrorCategory, ErrorSeverity } from "@/lib/errors";

interface BaseApplicationErrorOptions {
    code: string;
    message: string;
    httpStatus: number;
    severity: ErrorSeverity;
    category: ErrorCategory;
}

export class ParentError extends BaseApplicationError {

    // ======================================================
    // AUTHENTICATION / AUTHORIZATION (USED IN YOUR SERVICE)
    // ======================================================

    /**
     * PAR_001: Parent not found
     */
    static parentNotFound() {
        return new ParentError({
            code: 'PAR_001',
            message: 'Parent account not found',
            httpStatus: 404,
            severity: "WARNING" as ErrorSeverity,
            category: "NOT_FOUND" as ErrorCategory,
        });
    }

    /**
     * PAR_002: Invalid credentials
     */
    static invalidCredentials() {
        return new ParentError({
            code: 'PAR_002',
            message: 'Invalid email or password',
            httpStatus: 401,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHENTICATION" as ErrorCategory,
        });
    }

    /**
     * PAR_003: Account disabled
     */
    static accountDisabled(reason?: string) {
        return new ParentError({
            code: 'PAR_003',
            message: reason
                ? `Account disabled: ${reason}`
                : 'Account is disabled',
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }

    /**
     * PAR_004: Email already exists
     */
    static emailAlreadyExists() {
        return new ParentError({
            code: 'PAR_004',
            message: 'Email already registered',
            httpStatus: 409,
            severity: "WARNING" as ErrorSeverity,
            category: "CONFLICT" as ErrorCategory,
        });
    }

    /**
     * PAR_005: Invalid or expired invitation
     */
    static invitationInvalidOrExpired() {
        return new ParentError({
            code: 'PAR_005',
            message: 'Invitation token invalid or expired',
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    // ======================================================
    // VALIDATION / GENERIC
    // ======================================================

    /**
     * PAR_006: Validation error
     */
    static validationError(message?: string) {
        return new ParentError({
            code: 'PAR_006',
            message: message || 'Validation error',
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    /**
     * PAR_007: Database error
     */
    static databaseError(message?: string) {
        return new ParentError({
            code: 'PAR_007',
            message: message || 'Database operation failed',
            httpStatus: 500,
            severity: "ERROR" as ErrorSeverity,
            category: "INTERNAL" as ErrorCategory,
        });
    }

    // ======================================================
    // DOMAIN ERRORS (kept for future modules)
    // ======================================================

    static linkNotFound() {
        return new ParentError({
            code: 'PAR_008',
            message: 'Parent-child [learnerId] not found or inactive',
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }

    static insufficientKYCLevel(requiredLevel: number) {
        return new ParentError({
            code: 'PAR_009',
            message: `Insufficient KYC level. Required: ${requiredLevel}`,
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }


    /**
     * PAR_011: Parent already linked to this child
     * Attempting to create duplicate parent-learner [learnerId]
     */
    static alreadyLinked() {
        return new ParentError({
            code: 'PAR_011',
            message: 'This parent is already linked to this child',
            httpStatus: 409,
            severity: "WARNING" as ErrorSeverity,
            category: "CONFLICT" as ErrorCategory,
        });
    }

    /**
     * PAR_012: Learner not found
     */
    static learnerNotFound() {
        return new ParentError({
            code: 'PAR_012',
            message: 'Learner not found',
            httpStatus: 404,
            severity: "WARNING" as ErrorSeverity ,
            category: "NOT_FOUND" as ErrorCategory ,
        });
    }

    static sosRateLimitExceeded() {
        return new ParentError({
            code: 'PAR_010',
            message: 'SOS rate limit exceeded (3 per 24h)',
            httpStatus: 429,
            severity: "WARNING" as ErrorSeverity,
            category: "RATE_LIMIT" as ErrorCategory,
        });
    }

    constructor(options: BaseApplicationErrorOptions) {
        super(
            options.code,
            options.message,
            options.httpStatus,
            options.severity,
            options.category
        );

        Object.setPrototypeOf(this, ParentError.prototype);
    }
}