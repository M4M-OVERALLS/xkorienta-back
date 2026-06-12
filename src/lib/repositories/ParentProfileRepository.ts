import connectDB from "@/lib/mongodb";
import ParentProfile, { IParentProfile } from '@/models/ParentProfile';
import mongoose from 'mongoose';
import {KYCLevel, KYCStatus} from "@/models/enums";

export class ParentProfileRepository {
    /**
     * Create a new parent profile
     * Called during parent registration
     */
    async create(data: {
        user: mongoose.Types.ObjectId;
        preferredLanguage?: 'fr' | 'en';
    }): Promise<IParentProfile> {
        await connectDB();

        const parentProfile = new ParentProfile({
            user: data.user,
            preferredLanguage: data.preferredLanguage || 'fr',
            kycLevel: KYCLevel.NONE,
            kycStatus: KYCStatus.PENDING,
            isActive: true,
            isVerified: false,
            notificationPreferences: {
                sms: true,
                email: true,
                push: true,
            },
            // Remove loginAttempts if not in schema
        });

        return await parentProfile.save();
    }

    /**
     * Find parent profile by ID
     */
    async findById(id: mongoose.Types.ObjectId): Promise<IParentProfile | null> {
        await connectDB();
        return ParentProfile.findById(id);
    }

    /**
     * Find parent profile by user ID
     */
    async findByUserId(userId: mongoose.Types.ObjectId | string): Promise<IParentProfile | null> {
        await connectDB();
        return ParentProfile.findOne({ user: userId });
    }

    /**
     * Update parent profile
     */
    async update(userId: string, data: Partial<IParentProfile>): Promise<IParentProfile | null> {
        await connectDB();
        return ParentProfile.findOneAndUpdate(
            { user: userId },
            data,
            { new: true }
        );
    }

    /**
     * Disable parent account
     */
    async disableAccount(
        parentId: mongoose.Types.ObjectId,
        reason: string
    ): Promise<IParentProfile | null> {
        await connectDB();

        return ParentProfile.findByIdAndUpdate(
            parentId,
            {
                $set: {
                    isActive: false,
                    accountDisabledAt: new Date(),
                    accountDisabledReason: reason,
                },
            },
            { new: true }
        );
    }

    /**
     * Delete parent profile
     */
    async delete(parentId: mongoose.Types.ObjectId): Promise<boolean> {
        await connectDB();

        const result = await ParentProfile.findByIdAndDelete(parentId);
        return result !== null;
    }


    /**
     * Update KYC Level 1 (after document upload)
     */
    async updateKYCLevel1(
        parentId: mongoose.Types.ObjectId,
        data: {
            nationalId?: string;
            nationalIdType?: string;
            nationalIdDocumentUrl?: string;
            kycStatus: KYCStatus;
        }
    ): Promise<IParentProfile | null> {
        await connectDB();

        return await ParentProfile.findByIdAndUpdate(
            parentId,
            {
                $set: {
                    kycLevel: KYCLevel.LEVEL_1,
                    kycStatus: data.kycStatus,
                    nationalId: data.nationalId,
                    nationalIdType: data.nationalIdType,
                    nationalIdDocumentUrl: data.nationalIdDocumentUrl,
                    documentUploadedAt: new Date(),
                },
            },
            { new: true }
        );
    }

    /**
     * Verify KYC Level 1 (admin approval)
     */
    async verifyKYCLevel1(
        parentId: mongoose.Types.ObjectId,
        adminId: mongoose.Types.ObjectId,
        approved: boolean,
        reason?: string
    ): Promise<IParentProfile | null> {
        await connectDB();

        const updateData = approved
            ? {
                kycLevel: KYCLevel.LEVEL_1,
                kycStatus: KYCStatus.VERIFIED,
                kycVerifiedBy: adminId,
                kycVerifiedAt: new Date(),
                nationalIdVerified: true,
                kycRejectionReason: undefined,
            }
            : {
                kycLevel: KYCLevel.NONE,
                kycStatus: KYCStatus.REJECTED,
                kycVerifiedBy: adminId,
                kycVerifiedAt: new Date(),
                kycRejectionReason: reason,
            };

        return await ParentProfile.findByIdAndUpdate(
            parentId,
            { $set: updateData },
            { new: true }
        );
    }
    /**
     * Get all pending KYC Level 1 submissions (for admin)
     */
    async findPendingKYC(limit: number = 50): Promise<IParentProfile[]> {
        await connectDB();

        return await ParentProfile.find({
            kycStatus: { $in: [KYCStatus.SUBMITTED, KYCStatus.PENDING] },
            kycLevel: { $lt: KYCLevel.LEVEL_1 },
        })
            .populate('user', 'email name')
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Get parent KYC status summary
     */
    async getKYCStatus(parentId: mongoose.Types.ObjectId): Promise<{
        kycLevel: KYCLevel;
        kycStatus: KYCStatus;
        canAccessDashboard: boolean;
        nationalIdVerified: boolean;
    } | null> {
        await connectDB();

        const parent = await ParentProfile.findById(parentId);
        if (!parent) return null;

        return {
            kycLevel: parent.kycLevel,
            kycStatus: parent.kycStatus,
            canAccessDashboard: parent.canAccessDashboard(),
            nationalIdVerified: parent.nationalIdVerified,
        };
    }

    /**
     * Check if parent can access dashboard
     */
    async canAccessDashboard(parentId: mongoose.Types.ObjectId): Promise<boolean> {
        await connectDB();

        const parent = await ParentProfile.findById(parentId);
        if (!parent) return false;
        return parent.canAccessDashboard();
    }


    /**
     * Confirm KYC Level 2 (school admin confirmation)
     * Called after school confirms parent-child relationship
     */
    async confirmKYCLevel2(
        parentId: mongoose.Types.ObjectId,
        adminId: mongoose.Types.ObjectId
    ): Promise<IParentProfile | null> {
        await connectDB();

        return await ParentProfile.findByIdAndUpdate(
            parentId,
            {
                $set: {
                    kycLevel: KYCLevel.LEVEL_2,
                    kycStatus: KYCStatus.CONFIRMED,
                    kycVerifiedBy: adminId,
                    kycVerifiedAt: new Date(),
                    isActive: true, // Dashboard access now enabled
                },
            },
            { new: true }
        );
    }

}

export const parentProfileRepository = new ParentProfileRepository();