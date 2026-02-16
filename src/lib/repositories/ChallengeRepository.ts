import { Challenge, ChallengeProgress, ChallengeStatus } from "@/models/Challenge";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ChallengeRepository {
    /**
     * Find challenges accessible to a student based on their class, school, and level
     */
    async findAccessibleChallenges(
        classId: string | null,
        schoolId: string | null,
        levelId: string | null,
        statuses: ChallengeStatus[] = [ChallengeStatus.ACTIVE, ChallengeStatus.UPCOMING],
        limit: number = 20
    ) {
        await connectDB();

        const challengeQuery: Record<string, unknown> = {
            status: { $in: statuses },
            $or: [
                { targetClass: { $exists: false } }, // Global challenges
                { targetClass: null },
            ]
        };

        // Add class-specific challenges if student is in a class
        if (classId) {
            (challengeQuery.$or as Array<unknown>).push({ targetClass: new mongoose.Types.ObjectId(classId) });

            if (schoolId) {
                (challengeQuery.$or as Array<unknown>).push({ targetSchool: new mongoose.Types.ObjectId(schoolId) });
            }
            if (levelId) {
                (challengeQuery.$or as Array<unknown>).push({ targetLevel: new mongoose.Types.ObjectId(levelId) });
            }
        }

        return Challenge.find(challengeQuery)
            .populate('rewards.badgeId', 'name icon')
            .sort({ startDate: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Find challenge progress records for a student
     */
    async findStudentProgress(studentId: string, challengeIds: mongoose.Types.ObjectId[]) {
        await connectDB();
        return ChallengeProgress.find({
            userId: new mongoose.Types.ObjectId(studentId),
            challengeId: { $in: challengeIds }
        }).lean();
    }

    /**
     * Find a challenge by ID
     */
    async findById(challengeId: string) {
        await connectDB();
        return Challenge.findById(challengeId).lean();
    }

    /**
     * Find student progress for a specific challenge
     */
    async findStudentChallengeProgress(studentId: string, challengeId: string) {
        await connectDB();
        return ChallengeProgress.findOne({
            userId: new mongoose.Types.ObjectId(studentId),
            challengeId: new mongoose.Types.ObjectId(challengeId)
        }).lean();
    }

    /**
     * Add a participant to a challenge
     */
    async addParticipant(challengeId: string, studentId: string) {
        await connectDB();
        return Challenge.findByIdAndUpdate(
            challengeId,
            { $addToSet: { participants: new mongoose.Types.ObjectId(studentId) } },
            { new: true }
        );
    }

    /**
     * Create a challenge progress record
     */
    async createChallengeProgress(data: {
        userId: mongoose.Types.ObjectId;
        challengeId: mongoose.Types.ObjectId;
        progress: Array<{
            goalIndex: number;
            current: number;
            target: number;
            completed: boolean;
        }>;
        overallProgress: number;
        completed: boolean;
        startedAt: Date;
        lastUpdated: Date;
    }) {
        await connectDB();
        return ChallengeProgress.create(data);
    }
}
