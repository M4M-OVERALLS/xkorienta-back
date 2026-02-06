import Exam from "@/models/Exam";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ExamRepository {
    /**
     * Find exams by IDs
     */
    async findByIds(examIds: string[]) {
        await connectDB();
        const objectIds = examIds.map(id => new mongoose.Types.ObjectId(id));
        return Exam.find({ _id: { $in: objectIds } }).lean();
    }

    /**
     * Count exams created by teachers
     */
    async countExamsByTeachers(teacherIds: string[]): Promise<number> {
        await connectDB();
        if (teacherIds.length === 0) return 0;

        return Exam.countDocuments({
            createdById: { $in: teacherIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: { $in: ['ACTIVE', 'COMPLETED', 'PUBLISHED', 'VALIDATED'] }
        });
    }

    /**
     * Find recent exams created by teachers
     */
    async findRecentExamsByTeachers(teacherIds: string[], limit: number = 5) {
        await connectDB();
        if (teacherIds.length === 0) return [];

        return Exam.find({
            createdById: { $in: teacherIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: { $nin: ['DRAFT', 'ARCHIVED'] }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('title subject startTime status')
            .populate('subject', 'name')
            .lean();
    }

    /**
     * Count exams created by a teacher (all exams including drafts)
     */
    async countExamsByTeacher(teacherId: string): Promise<number> {
        await connectDB();
        return Exam.countDocuments({ createdById: new mongoose.Types.ObjectId(teacherId) });
    }

    /**
     * Count published exams by a teacher (all exams with status PUBLISHED)
     */
    async countPublishedExamsByTeacher(teacherId: string): Promise<number> {
        await connectDB();
        return Exam.countDocuments({
            createdById: new mongoose.Types.ObjectId(teacherId),
            $or: [
                { status: 'PUBLISHED' },
                { isPublished: true }
            ]
        });
    }

    /**
     * Count active exams (Published and currently ongoing) by a teacher
     */
    async countActiveExamsByTeacher(teacherId: string): Promise<number> {
        await connectDB();
        const now = new Date();
        return Exam.countDocuments({
            createdById: new mongoose.Types.ObjectId(teacherId),
            $or: [
                { status: 'PUBLISHED' },
                { isPublished: true }
            ],
            startTime: { $lte: now },
            endTime: { $gte: now }
        });
    }

    /**
     * Find exam IDs created by a teacher (published/active exams only)
     */
    async findExamIdsByTeacher(teacherId: string): Promise<string[]> {
        await connectDB();
        const exams = await Exam.find({
            createdById: new mongoose.Types.ObjectId(teacherId),
            $or: [
                { status: { $in: ['PUBLISHED', 'VALIDATED', 'ACTIVE'] } },
                { isPublished: true }
            ]
        }).select('_id').lean();
        return exams.map((e: any) => e._id.toString());
    }

    /**
     * Find recent exams created by a user with populated relations
     */
    async findRecentExamsByUser(userId: string, limit: number = 5) {
        await connectDB();
        return Exam.find({ createdById: new mongoose.Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('subject', 'name')
            .populate('targetLevels', 'name')
            .lean();
    }

    /**
     * Find exam by ID
     */
    async findById(examId: string) {
        await connectDB();
        return Exam.findById(examId);
    }

    /**
     * Save exam document (for updates)
     */
    async save(exam: any) {
        await connectDB();
        if (exam instanceof mongoose.Model || exam instanceof mongoose.Document) {
            return exam.save();
        }
        throw new Error("Invalid exam document for save operation.");
    }
}
