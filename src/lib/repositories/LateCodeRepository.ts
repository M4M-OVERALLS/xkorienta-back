import LateCode, { ILateCode } from "@/models/LateCode";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class LateCodeRepository {
    /**
     * Create late code
     */
    async create(data: Partial<ILateCode>): Promise<ILateCode> {
        await connectDB();
        return LateCode.create(data);
    }

    /**
     * Find late code by code and examId
     */
    async findByCodeAndExamId(code: string, examId: string): Promise<ILateCode | null> {
        await connectDB();
        return LateCode.findOne({ code, examId })
            .populate('examId', 'title endTime')
            .populate('generatedBy', 'name email');
    }

    /**
     * Find late code by ID
     */
    async findById(id: string): Promise<ILateCode | null> {
        await connectDB();
        return LateCode.findById(id);
    }

    /**
     * Find late codes by examId
     */
    async findByExamId(examId: string): Promise<ILateCode[]> {
        await connectDB();
        return LateCode.find({ examId: new mongoose.Types.ObjectId(examId) })
            .populate('generatedBy', 'name email')
            .populate('assignedUserId', 'name email')
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Find late code with valid access for user
     */
    async findValidLateAccess(examId: string, userId: string): Promise<ILateCode | null> {
        await connectDB();
        return LateCode.findOne({
            examId: new mongoose.Types.ObjectId(examId),
            status: 'ACTIVE',
            expiresAt: { $gt: new Date() },
            'usageHistory.userId': new mongoose.Types.ObjectId(userId)
        });
    }

    /**
     * Save late code document (for updates)
     */
    async save(lateCode: ILateCode): Promise<ILateCode> {
        if (lateCode instanceof mongoose.Model || lateCode instanceof mongoose.Document) {
            return lateCode.save();
        }
        throw new Error("Invalid late code document for save operation.");
    }
}
