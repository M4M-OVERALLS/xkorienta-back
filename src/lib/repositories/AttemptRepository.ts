import Attempt, { IAttempt, AttemptStatus } from "@/models/Attempt";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class AttemptRepository {
    async findById(id: string): Promise<IAttempt | null> {
        await connectDB();
        return Attempt.findById(id).populate('examId', 'title description duration config').lean(); // Careful with lean if saving later, but for reads ok. 
        // Actually, Service uses save() on document, so better return mongoose document for update operations
    }

    async findByIdForUpdate(id: string): Promise<IAttempt | null> {
        await connectDB();
        return Attempt.findById(id);
    }

    async save(attempt: IAttempt): Promise<IAttempt> {
        // In Mongoose, you call save() on the document instance. 
        // Only if we passed a plain object we might need model.create or update.
        // But here we likely get a document from findByIdForUpdate.
        if (attempt instanceof mongoose.Model || attempt instanceof mongoose.Document) {
            return attempt.save();
        }
        // Fallback or if lean was used (should be avoided for updates generally unless using findOneAndUpdate)
        return attempt;
    }

    /**
     * Find completed attempts for a user
     */
    async findCompletedAttempts(userId: string) {
        await connectDB();
        return Attempt.find({
            userId: new mongoose.Types.ObjectId(userId),
            status: "COMPLETED"
        }).sort({ submittedAt: -1 }).lean();
    }

    /**
     * Get average score for multiple users
     */
    async getAverageScoreForUsers(userIds: string[]): Promise<number> {
        await connectDB();
        if (userIds.length === 0) return 0;

        const avgStats = await Attempt.aggregate([
            {
                $match: {
                    userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    avg: { $avg: "$percentage" }
                }
            }
        ]);

        return avgStats.length > 0 ? avgStats[0].avg : 0;
    }

    /**
     * Get score distribution for multiple users
     */
    async getScoreDistributionForUsers(userIds: string[]) {
        await connectDB();
        if (userIds.length === 0) {
            return [
                { _id: 0, count: 0 },
                { _id: 20, count: 0 },
                { _id: 40, count: 0 },
                { _id: 60, count: 0 },
                { _id: 80, count: 0 }
            ];
        }

        return Attempt.aggregate([
            {
                $match: {
                    userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: 'COMPLETED'
                }
            },
            {
                $bucket: {
                    groupBy: "$percentage",
                    boundaries: [0, 20, 40, 60, 80, 101],
                    default: "Other",
                    output: { count: { $sum: 1 } }
                }
            }
        ]);
    }

    /**
     * Get weekly performance for multiple users
     */
    async getWeeklyPerformanceForUsers(userIds: string[], weeksAgo: number = 8) {
        await connectDB();
        if (userIds.length === 0) return [];

        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - (weeksAgo * 7));

        return Attempt.aggregate([
            {
                $match: {
                    userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: 'COMPLETED',
                    submittedAt: { $gte: dateLimit }
                }
            },
            {
                $group: {
                    _id: { $week: "$submittedAt" },
                    avgScore: { $avg: "$percentage" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: weeksAgo }
        ]);
    }

    /**
     * Count attempts for multiple users
     */
    async countAttemptsForUsers(userIds: string[], status?: string): Promise<number> {
        await connectDB();
        if (userIds.length === 0) return 0;

        const match: any = {
            userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) }
        };

        if (status) {
            match.status = status;
        }

        return Attempt.countDocuments(match);
    }

    /**
     * Find attempt by resume token
     */
    async findByResumeToken(token: string): Promise<IAttempt | null> {
        await connectDB();
        return Attempt.findOne({ resumeToken: token }).lean();
    }

    /**
     * Get average score for attempts of specific exams
     */
    async getAverageScoreForExams(examIds: string[]): Promise<number> {
        await connectDB();
        if (examIds.length === 0) return 0;

        const avgScoreResult = await Attempt.aggregate([
            {
                $match: {
                    examId: { $in: examIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$score' }
                }
            }
        ]);

        return avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;
    }
}
