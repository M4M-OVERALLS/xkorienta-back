/**
 * Audit Log Model
 * Immutable compliance trail for all sensitive parent module actions
 *
 * Hash verification: Each record has a SHA256 hash combining:
 *   - actor ID
 *   - action type
 *   - target entity
 *   - timestamp
 * This prevents tampering/deletion of audit records
 */

import mongoose, { Document, Schema } from 'mongoose';
import { AuditAction } from '@/models/enums';

/**
 * Audit Log Document Interface
 */
export interface IAuditLog extends Document {
    // Request context
    requestId: string; // Unique ID for tracing related operations

    // Actor & Action
    actor: mongoose.Types.ObjectId; // User who performed the action
    action: AuditAction; // Type of action (KYC_VERIFIED, LINK_APPROVED, SOS_TRIGGERED, etc.)

    // Target entity
    targetId: mongoose.Types.ObjectId; // Entity being acted upon
    targetType: string; // Type of target (ParentProfile, ParentLearnerLink, SOSAlert, etc.)

    // Details
    metadata: Record<string, any>; // Additional context (before/after values, reasons, etc.)
    ipAddress?: string; // Client IP address for security audit
    userAgent?: string; // Browser/app user agent

    // Tamper detection
    hash: string; // SHA256(actor + action + targetId + timestamp) for integrity verification

    // Timestamps
    createdAt: Date;

    // Immutable flag (set after creation)
    isImmutable: boolean;
}

/**
 * Audit Log Schema
 */
const auditLogSchema = new Schema<IAuditLog>(
    {
        requestId: {
            type: String,
            required: true,
            index: true,
            description: 'Unique request ID for tracing',
        },

        actor: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            description: 'User who performed the action',
        },

        action: {
            type: String,
            enum: Object.values(AuditAction),
            required: true,
            index: true,
            description: 'Type of audit action',
        },

        targetId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
            description: 'Primary entity affected by action',
        },

        targetType: {
            type: String,
            required: true,
            enum: [
                'ParentProfile',
                'ParentLearnerLink',
                'SOSAlert',
                'EarlyWarningAlert',
                'User',
                'Invitation',
            ],
            description: 'Type of target entity',
        },

        metadata: {
            type: Schema.Types.Mixed,
            default: {},
            description: 'Additional action details (before/after, reasons, etc.)',
        },

        ipAddress: {
            type: String,
            description: 'Client IP address for security audit',
        },

        userAgent: {
            type: String,
            description: 'Browser/app user agent string',
        },

        hash: {
            type: String,
            required: true,
            index: true,
            description: 'SHA256 hash for tamper detection',
        },

        isImmutable: {
            type: Boolean,
            default: true,
            description: 'Records should never be modified (read-only)',
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false }, // No updatedAt for immutability
        collection: 'audit_logs',
    }
);

// ============================================================================
// INDEXES - For compliance queries
// ============================================================================

// Find all actions by an actor
auditLogSchema.index({ actor: 1, createdAt: -1 }, { name: 'idx_actor_timeline' });

// Find all actions on a target
auditLogSchema.index({ targetId: 1, createdAt: -1 }, { name: 'idx_target_timeline' });

// Find actions by type
auditLogSchema.index({ action: 1, createdAt: -1 }, { name: 'idx_action_timeline' });

// Find by action + actor (who did what)
auditLogSchema.index(
    { action: 1, actor: 1, createdAt: -1 },
    { name: 'idx_action_actor' }
);

// Date range queries for audit reports
auditLogSchema.index({ createdAt: -1 }, { name: 'idx_date' });

// Request tracing
auditLogSchema.index({ requestId: 1 }, { name: 'idx_request_id' });

// ============================================================================
// IMMUTABILITY ENFORCEMENT
// ============================================================================

/**
 * Prevent updates to audit logs (should never be modified)
 */

auditLogSchema.pre('updateOne', function () {
    throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateMany', function () {
    throw new Error('Audit logs are immutable and cannot be updated');
});

/**
 * Prevent deletion of audit logs (7-year retention required)
 */
auditLogSchema.pre('deleteOne', function () {
    throw new Error('Audit logs cannot be deleted (7-year retention policy)');
});

auditLogSchema.pre('deleteMany', function () {
    throw new Error('Audit logs cannot be deleted (7-year retention policy)');
});

// ============================================================================
// VIRTUALS & METHODS
// ============================================================================

/**
 * Verify hash integrity (detect tampering)
 */
auditLogSchema.methods.verifyHash = function (crypto: any): boolean {
    const crypto_module = require('crypto');
    const expectedHash = crypto_module
        .createHash('sha256')
        .update(
            `${this.actor}${this.action}${this.targetId}${this.createdAt.getTime()}`
        )
        .digest('hex');

    return this.hash === expectedHash;
};

/**
 * Get human-readable description of action
 */
auditLogSchema.methods.getDescription = function (): string {
    const actionDescriptions: Record<AuditAction, string> = {
        KYC_L1_SUBMITTED: 'Submitted KYC Level 1 document',
        KYC_L1_VERIFIED: 'Verified KYC Level 1',
        KYC_L1_REJECTED: 'Rejected KYC Level 1',
        KYC_L2_VERIFIED: 'Confirmed KYC Level 2 (school relationship)',
        LINK_CREATED: 'Created parent-learner link request',
        LINK_APPROVED: 'Approved parent-learner link',
        LINK_REVOKED: 'Revoked parent-learner link',
        SOS_TRIGGERED: 'Triggered SOS alert',
        SOS_ACKNOWLEDGED: 'Acknowledged SOS alert',
        DASHBOARD_ACCESSED: 'Accessed child dashboard',
    };

    return actionDescriptions[this.action as AuditAction] || this.action;
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;