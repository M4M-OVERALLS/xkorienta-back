import mongoose, { Document, Model, Schema } from 'mongoose';
import { KYCLevel, KYCStatus } from '@/models/enums';

interface IParentProfileMethods {
    canAccessDashboard(): boolean;
    canRequestChildLink(): boolean;
}

export interface IParentProfile extends Document, IParentProfileMethods {
    user: mongoose.Types.ObjectId; // Reference to User model (role = PARENT)

    // KYC Verification information
    kycLevel: KYCLevel;
    kycStatus: KYCStatus;
    kycVerifiedBy?: mongoose.Types.ObjectId; // Administrator who did the verification
    kycVerifiedAt?: Date;
    kycRejectionReason?: string; //If KYC is rejected here we indicate the reason

    // Identity Document
    nationalId?: string; // ID number from document
    nationalIdType?: string; // The type of the document submitted NATIONAL_ID, PASSPORT, DRIVER_LICENSE
    nationalIdDocumentUrl?: string; // the URL we will use to uploaded document
    nationalIdVerified: boolean; // Admin confirmed document is valid
    documentUploadedAt?: Date;

    // Preferences
    preferredLanguage: 'fr' | 'en';
    notificationPreferences: {
        sms: boolean;
        email: boolean;
        push: boolean;
    };

    // Account Status
    isActive: boolean; // Parent can login
    isVerified: boolean; // Email verified (if applicable)
    accountDisabledAt?: Date; // if account is disabled the date
    accountDisabledReason?: string; // if account is disabled the reason

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

const parentProfileSchema = new Schema<IParentProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            description: 'Reference to User model (role must be PARENT)',
        },

        // KYC Verification
        kycLevel: {
            type: Number,
            enum: [KYCLevel.NONE, KYCLevel.LEVEL_1, KYCLevel.LEVEL_2],
            default: KYCLevel.NONE,
            description: '0=none, 1=identity verified, 2=relationship confirmed',
        },

        kycStatus: {
            type: String,
            enum: Object.values(KYCStatus),
            default: KYCStatus.PENDING,
            description: 'Current KYC verification status',
        },

        kycVerifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            description: 'Admin who verified this parent',
        },

        kycVerifiedAt: {
            type: Date,
            description: 'When KYC was verified',
        },

        kycRejectionReason: {
            type: String,
            description: 'Why KYC was rejected',
        },

        // Identity Document
        nationalId: {
            type: String,
            description: 'ID number from uploaded document',
        },

        nationalIdType: {
            type: String,
            enum: ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE'],
            description: 'Type of identity document',
        },

        nationalIdDocumentUrl: {
            type: String,
            description: 'URL to uploaded document',
        },

        nationalIdVerified: {
            type: Boolean,
            default: false,
            description: 'Admin confirmed document is valid and readable',
        },

        documentUploadedAt: {
            type: Date,
            description: 'When document was uploaded',
        },

        // Preferences
        preferredLanguage: {
            type: String,
            enum: ['fr', 'en'],
            default: 'fr',
            description: 'Parent preferred language for communications',
        },

        notificationPreferences: {
            sms: {
                type: Boolean,
                default: true,
                description: 'Allow SMS notifications',
            },
            email: {
                type: Boolean,
                default: true,
                description: 'Allow email notifications',
            },
            push: {
                type: Boolean,
                default: true,
                description: 'Allow push notifications',
            },
        },

        // Account Status
        isActive: {
            type: Boolean,
            default: false,
            description: 'Parent can login (requires KYC L2)',
        },

        isVerified: {
            type: Boolean,
            default: false,
            description: 'Email address verified',
        },

        accountDisabledAt: {
            type: Date,
            description: 'When account was disabled',
        },

        accountDisabledReason: {
            type: String,
            description: 'Why account was disabled',
        },

        // Metadata
        createdAt: {
            type: Date,
            description: 'Date at which account was created',
        },
        updatedAt: {
            type: Date,
            description: 'Date at which account was updated',
        },
        lastLoginAt: {
            type: Date,
            description: 'Last successful login timestamp',
        },
    },
    {
        timestamps: true,
        collection: 'parent_profiles',
    }
);

// Instance Methods

/**
 * Can this parent access the dashboard?
 * Requires: that the parent is KYC L2 verified and account is active
 */
parentProfileSchema.methods.canAccessDashboard = function (): boolean {
    return this.kycLevel >= KYCLevel.LEVEL_2 && this.isActive;
};

/**
 * Can this parent request child links?
 * Requires: KYC L1 verified minimum
 */
parentProfileSchema.methods.canRequestChildLink = function (): boolean {
    return this.kycLevel >= KYCLevel.LEVEL_1;
};

const ParentProfile: Model<IParentProfile> =
    mongoose.models.ParentProfile || mongoose.model<IParentProfile>('ParentProfile', parentProfileSchema);

export default ParentProfile;