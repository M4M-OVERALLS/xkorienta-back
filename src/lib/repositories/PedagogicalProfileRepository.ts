import PedagogicalProfile, { IPedagogicalProfile } from "@/models/PedagogicalProfile";
import connectDB from "@/lib/mongodb";

export class PedagogicalProfileRepository {
    /**
     * Find pedagogical profile by user ID with populated relations
     */
    async findByUserId(userId: string): Promise<IPedagogicalProfile | null> {
        await connectDB();
        return PedagogicalProfile.findOne({ user: userId })
            .populate('teachingSubjects', 'name code')
            .populate('interventionLevels', 'name code cycle')
            .populate('interventionFields', 'name code')
            .lean();
    }

    /**
     * Update pedagogical profile
     */
    async update(userId: string, data: Partial<IPedagogicalProfile>): Promise<IPedagogicalProfile | null> {
        await connectDB();
        return PedagogicalProfile.findOneAndUpdate(
            { user: userId },
            { $set: data },
            { new: true, runValidators: true }
        );
    }

    /**
     * Find pedagogical profile by user ID (without populate, for existence check)
     */
    async findByUserIdBasic(userId: string): Promise<IPedagogicalProfile | null> {
        await connectDB();
        return PedagogicalProfile.findOne({ user: userId });
    }

    /**
     * Create pedagogical profile
     */
    async create(data: Partial<IPedagogicalProfile>): Promise<IPedagogicalProfile> {
        await connectDB();
        return PedagogicalProfile.create(data);
    }
}
