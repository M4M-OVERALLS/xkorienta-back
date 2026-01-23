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
}
