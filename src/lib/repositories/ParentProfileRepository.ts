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
}

export const parentProfileRepository = new ParentProfileRepository();