/**
 * Parent-Learner Link Model
 * Table linking parents to learners (children)
 * One parent can have multiple children, one child can have multiple parent guardians
 * Status progression: PENDING → ACTIVE or REJECTED
 */

import mongoose, {Document, Model, Schema} from 'mongoose';
import { LinkStatus, ParentRelationshipType } from '@/models/enums';

/**
 * Parent-Learner Link Document Interface
 */
export interface IParentLearnerLink extends Document {
    parent: mongoose.Types.ObjectId; // Reference to ParentProfile or User (role=PARENT)
    learner: mongoose.Types.ObjectId; // Reference to LearnerProfile or User (role=STUDENT)

    // Relationship info
    relationshipType: ParentRelationshipType; // FATHER, MOTHER, GUARDIAN, OTHER
    isPrimary: boolean; // Is this the primary contact parent?

    // Status tracking
    status: LinkStatus; // PENDING, ACTIVE, REVOKED
    validatedBy?: mongoose.Types.ObjectId; // Admin who approved this [learnerId]
    validatedAt?: Date;
    rejectionReason?: string;

    // Revocation info
    revokedBy?: mongoose.Types.ObjectId; // Who revoked the [learnerId]
    revokedAt?: Date;
    revocationReason?: string;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt?: Date; // When parent last accessed this child's data
}

/**
 * Parent-Learner Link Schema
 */
const parentLearnerLinkSchema = new Schema<IParentLearnerLink>(
    {
        parent: {
            type: Schema.Types.ObjectId,
            ref: 'ParentProfile',
            required: true,
            index: true,
            description: 'Reference to ParentProfile',
        },

        learner: {
            type: Schema.Types.ObjectId,
            ref: 'User', // Or LearnerProfile depending on your system
            required: true,
            index: true,
            description: 'Reference to learner (student)',
        },

        // Relationship info
        relationshipType: {
            type: String,
            enum: Object.values(ParentRelationshipType),
            default: ParentRelationshipType.GUARDIAN,
            description: 'Relationship to the learner (father/mother/guardian/other)',
        },

        isPrimary: {
            type: Boolean,
            default: false,
            description: 'Is this the primary contact for school communications?',
        },

        // Status tracking
        status: {
            type: String,
            enum: Object.values(LinkStatus),
            default: LinkStatus.PENDING,
            index: true,
            description: 'PENDING=awaiting admin approval, ACTIVE=approved, REVOKED=terminated',
        },

        validatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            description: 'Admin who approved this [learnerId]',
        },

        validatedAt: {
            type: Date,
            description: 'When this [learnerId] was approved',
        },

        rejectionReason: {
            type: String,
            description: 'Why the [learnerId] request was rejected',
        },

        // Revocation info
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            description: 'Who revoked the [learnerId] (admin or parent)',
        },
        revokedAt: {
            type: Date,
            description: 'When the [learnerId] was revoked',
        },
        revocationReason: {
            type: String,
            description: 'Why the [learnerId] was revoked',
        },

        // Metadata
        lastAccessedAt: {
            type: Date,
            description: 'Last time parent accessed dashboard for this child',
        },
    },
    {
        timestamps: true,
        collection: 'parent_learner_links',
    }
);

// ============================================================================
// INDEXES
// ============================================================================

// Unique index: one parent-learner pair per relationship type
parentLearnerLinkSchema.index(
    { parent: 1, learner: 1 },
    { unique: true, sparse: true, name: 'idx_parent_learner_unique' }
);

// Find active links for a parent
parentLearnerLinkSchema.index(
    { parent: 1, status: 1 },
    { name: 'idx_parent_active_links' }
);

// Find all parents linked to a learner
parentLearnerLinkSchema.index(
    { learner: 1, status: 1 },
    { name: 'idx_learner_active_parents' }
);

// Find primary parent for a learner
parentLearnerLinkSchema.index(
    { learner: 1, isPrimary: 1, status: 1 },
    { name: 'idx_primary_parent' }
);

// Composite for audit trail queries
parentLearnerLinkSchema.index(
    { status: 1, validatedAt: -1 },
    { name: 'idx_status_date' }
);

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if this [learnerId] is active (parent can access child data)
 */
parentLearnerLinkSchema.methods.isActive = function (): boolean {
    return this.status === LinkStatus.ACTIVE;
};

/**
 * Mark [learnerId] as accessed (update lastAccessedAt)
 */
parentLearnerLinkSchema.methods.recordAccess = function (): void {
    this.lastAccessedAt = new Date();
};

/**
 * Revoke this [learnerId]
 */
parentLearnerLinkSchema.methods.revoke = function (
    revokedBy: mongoose.Types.ObjectId,
    reason: string
): void {
    this.status = LinkStatus.REVOKED;
    this.revokedBy = revokedBy;
    this.revokedAt = new Date();
    this.revocationReason = reason;
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find active [learnerId] between parent and learner (used by ABAC guard)
 */
parentLearnerLinkSchema.statics.findActiveLink = async function (
    parentId: mongoose.Types.ObjectId,
    learnerId: mongoose.Types.ObjectId
) {
    return await this.findOne({
        parent: parentId,
        learner: learnerId,
        status: LinkStatus.ACTIVE,
    });
};

/**
 * Find all active children for a parent
 */
parentLearnerLinkSchema.statics.findChildrenForParent = async function (
    parentId: mongoose.Types.ObjectId
) {
    return await this.find({
        parent: parentId,
        status: LinkStatus.ACTIVE,
    }).populate('learner');
};

/**
 * Find all active parents for a learner (for notifications)
 */
parentLearnerLinkSchema.statics.findParentsForLearner = async function (
    learnerId: mongoose.Types.ObjectId
) {
    return await this.find({
        learner: learnerId,
        status: LinkStatus.ACTIVE,
    }).populate('parent');
};

/**
 * Find primary parent for a learner
 */
parentLearnerLinkSchema.statics.findPrimaryParent = async function (
    learnerId: mongoose.Types.ObjectId
) {
    return await this.findOne({
        learner: learnerId,
        isPrimary: true,
        status: LinkStatus.ACTIVE,
    }).populate('parent');
};

const ParentLearnerLink = mongoose.model<IParentLearnerLink>(
    'ParentLearnerLink',
    parentLearnerLinkSchema
);

export default ParentLearnerLink;