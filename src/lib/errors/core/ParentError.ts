/**
 * Parent Module Error Class
 * Extends BaseApplicationError with parent-specific error codes
 * Follows the same pattern as AuthenticationError in existing system
 */


import {BaseApplicationError} from "@/lib/errors";
import {ErrorCategory, ErrorSeverity} from "@/lib/errors";

// base interface which describes the format of an error response for a known error
interface BaseApplicationErrorOptions {
    code: string;
    message: string;
    httpStatus: number;
    severity: ErrorSeverity;
    category: ErrorCategory;
}

/**
 * Parent-specific Error Class
 * Factory methods for all parent module errors
 */
export class ParentError extends BaseApplicationError {
    /**
     * PAR_001: Parent-child link not found or inactive
     * Parent attempts to access data they're not linked to
     */
    static linkNotFound() {
        return new ParentError({
            code: 'PAR_001',
            message: 'Parent-child link not found or inactive',
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }

    /**
     * PAR_002: Insufficient KYC level
     * Parent trying to access dashboard without KYC L2
     */
    static insufficientKYCLevel(requiredLevel: number) {
        return new ParentError({
            code: 'PAR_002',
            message: `Insufficient KYC level for this action. Required: ${requiredLevel}`,
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }

    /**
     * PAR_003: SOS rate limit exceeded
     * Parent exceeded 3 SOS alerts per 24 hours
     */
    static sosRateLimitExceeded() {
        return new ParentError({
            code: 'PAR_003',
            message: 'SOS alert rate limit reached (3 per 24h)',
            httpStatus: 429,
            severity: "WARNING" as ErrorSeverity,
            category: "RATE_LIMIT" as ErrorCategory,
        });
    }

    /**
     * PAR_004: Invalid or expired invitation token
     */
    static invalidInvitationToken() {
        return new ParentError({
            code: 'PAR_004',
            message: 'Invitation token invalid or expired',
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    /**
     * PAR_005: Parent already linked to this child
     * Attempting to create duplicate parent-learner link
     */
    static alreadyLinked() {
        return new ParentError({
            code: 'PAR_005',
            message: 'This parent is already linked to this child',
            httpStatus: 409,
            severity: "WARNING" as ErrorSeverity,
            category: "CONFLICT" as ErrorCategory,
        });
    }

    /**
     * PAR_006: Learner not found in admin's school
     * School admin trying to approve link for learner not in their school
     */
    static learnerNotInSchool() {
        return new ParentError({
            code: 'PAR_006',
            message: 'Learner not found in your school',
            httpStatus: 403,
            severity: "WARNING" as ErrorSeverity,
            category: "AUTHORIZATION" as ErrorCategory,
        });
    }

    /**
     * PAR_007: KYC L1 must be verified before L2 confirmation
     */
    static kycL1NotVerified() {
        return new ParentError({
            code: 'PAR_007',
            message: 'KYC Level 1 must be verified before Level 2 confirmation',
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    /**
     * PAR_008: File upload failed
     */
    static fileUploadFailed(reason?: string) {
        return new ParentError({
            code: 'PAR_008',
            message: `File upload failed${reason ? ': ' + reason : ''}`,
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    /**
     * PAR_009: Invalid file type or size
     */
    static invalidFileFormat() {
        return new ParentError({
            code: 'PAR_009',
            message: 'Invalid file format. Allowed: JPEG, PNG, PDF. Max size: 5MB',
            httpStatus: 400,
            severity: "WARNING" as ErrorSeverity,
            category: "VALIDATION" as ErrorCategory,
        });
    }

    /**
     * PAR_010: Database error
     */
    static databaseError(message?: string) {
        return new ParentError({
            code: 'PAR_010',
            message: message || 'Database operation failed',
            httpStatus: 500,
            severity: "ERROR" as ErrorSeverity,
            category: "INTERNAL" as ErrorCategory,
        });
    }

    /**
     * PAR_011: SMS/Email service failure
     */
    static notificationServiceFailed(service: string) {
        return new ParentError({
            code: 'PAR_011',
            message: `${service} notification service unavailable. Please try again later.`,
            httpStatus: 503,
            severity: "WARNING" as ErrorSeverity,
            category: "EXTERNAL_SERVICE" as ErrorCategory,
        });
    }

    /**
     * PAR_012: Parent account not found
     */
    static parentNotFound() {
        return new ParentError({
            code: 'PAR_012',
            message: 'Parent account not found',
            httpStatus: 404,
            severity: "WARNING" as ErrorSeverity,
            category: "NOT_FOUND" as ErrorCategory,
        });
    }

    /**
     * PAR_013: Learner not found
     */
    static learnerNotFound() {
        return new ParentError({
            code: 'PAR_013',
            message: 'Learner not found',
            httpStatus: 404,
            severity: "WARNING" as ErrorSeverity,
            category: "NOT_FOUND" as ErrorCategory,
        });
    }

    /**
     * Generic constructor for other errors
     */
    constructor(options: BaseApplicationErrorOptions) {
        super(options.code, options.message, options.httpStatus, options.severity, options.category);
        Object.setPrototypeOf(this, ParentError.prototype);
    }
}