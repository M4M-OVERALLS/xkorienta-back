import LearnerProfile, { ILearnerProfile } from "@/models/LearnerProfile";
import connectDB from "@/lib/mongodb";

export class LearnerProfileRepository {
    /**
     * Find learner profile by user ID with populated relations
     */
    async findByUserId(userId: string): Promise<ILearnerProfile | null> {
        await connectDB();
        return LearnerProfile.findOne({ user: userId })
            .populate('currentLevel', 'name code cycle')
            .populate('currentField', 'name code')
            .populate('stats.strongSubjects', 'name code')
            .populate('stats.weakSubjects', 'name code')
            .lean();
    }

    /**
     * Find learner profile by user ID with basic populate (for student profile route)
     */
    async findByUserIdBasic(userId: string): Promise<ILearnerProfile | null> {
        await connectDB();
        return LearnerProfile.findOne({ user: userId })
            .populate('currentLevel')
            .populate('currentField')
            .lean();
    }

    /**
     * Update learner profile
     */
    async update(userId: string, data: Partial<ILearnerProfile>): Promise<ILearnerProfile | null> {
        await connectDB();
        return LearnerProfile.findOneAndUpdate(
            { user: userId },
            data,
            { new: true }
        );
    }

    /**
     * Find learner profile with stats populated
     */
    async findByUserIdWithStats(userId: string): Promise<ILearnerProfile | null> {
        await connectDB();
        return LearnerProfile.findOne({ user: userId })
            .populate('stats.strongSubjects', 'name code')
            .populate('stats.weakSubjects', 'name code')
            .lean();
    }

    /**
     * Find and update learner profile with upsert option (for onboarding)
     */
    async findOneAndUpdateUpsert(
        userId: string,
        setOnInsert: any,
        set: any
    ): Promise<ILearnerProfile | null> {
        await connectDB();
        return LearnerProfile.findOneAndUpdate(
            { user: userId },
            {
                $setOnInsert: setOnInsert,
                $set: set
            },
            { upsert: true, new: true }
        );
    }
}
