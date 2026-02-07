import Class, { IClass } from "@/models/Class"
import User from "@/models/User"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import EducationLevel from "@/models/EducationLevel"
import School from "@/models/School"
import Field from "@/models/Field"
import Subject from "@/models/Subject"
import mongoose from "mongoose"
import { ClassValidationStatus } from "@/models/enums"

// Ensure all models are registered (Next.js serverless context fix)
const _models = { Class, User, Attempt, Exam, EducationLevel, School, Field, Subject }

export class ClassService {
    /**
     * Create a new class
     * NOTE: New classes are created with PENDING validation status
     * They must be validated by a School Admin to become official
     */
    static async createClass(data: Partial<IClass>, teacherId: string) {
        const newClass = await Class.create({
            ...data,
            mainTeacher: teacherId,
            students: [],
            validationStatus: ClassValidationStatus.PENDING // New classes need approval
        })

        // Auto-enroll teacher in school if not already
        if (data.school) {
            const School = mongoose.models.School || mongoose.model('School');
            const User = mongoose.models.User || mongoose.model('User');

            await School.findByIdAndUpdate(data.school, {
                $addToSet: { teachers: teacherId }
            });

            await User.findByIdAndUpdate(teacherId, {
                $addToSet: { schools: data.school }
            });
        }

        return newClass
    }

    /**
     * Enroll a student in a class
     */
    static async enrollStudent(classId: string, studentId: string) {
        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { $addToSet: { students: studentId } },
            { new: true }
        )
        return updatedClass
    }

    /**
     * Get classes for a teacher
     * Now includes performance data for each class
     */
    static async getTeacherClasses(teacherId: string) {
        const Attempt = mongoose.models.Attempt || mongoose.model('Attempt');

        const classes = await Class.find({ mainTeacher: teacherId })
            .populate('level', 'name code')
            .populate('school', 'name')
            .populate('field', 'name code')
            .populate({ path: 'specialty', select: 'name code', strictPopulate: false })
            .populate('students', '_id name')
            .sort({ createdAt: -1 })
            .lean()

        // For each class, compute performance stats
        const classesWithStats = await Promise.all(classes.map(async (cls: any) => {
            const studentIds = cls.students?.map((s: any) => s._id) || [];

            // Skip stats if no students
            if (studentIds.length === 0) {
                return {
                    ...cls,
                    studentsCount: 0,
                    averageScore: 0,
                    examsCount: 0,
                    performanceHistory: []
                };
            }

            // Get global average and performance history in one aggregation
            const [globalStats, performanceHistory] = await Promise.all([
                // Global stats
                Attempt.aggregate([
                    {
                        $match: {
                            userId: { $in: studentIds },
                            status: 'COMPLETED'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            averageScore: { $avg: "$percentage" },
                            totalAttempts: { $sum: 1 }
                        }
                    }
                ]),
                // Performance history (last 7 exams for chart)
                Attempt.aggregate([
                    {
                        $match: {
                            userId: { $in: studentIds },
                            status: 'COMPLETED'
                        }
                    },
                    {
                        $lookup: {
                            from: "exams",
                            localField: "examId",
                            foreignField: "_id",
                            as: "exam"
                        }
                    },
                    { $unwind: "$exam" },
                    {
                        $group: {
                            _id: "$exam._id",
                            date: { $first: "$submittedAt" },
                            value: { $avg: "$percentage" }
                        }
                    },
                    { $sort: { date: -1 } },
                    { $limit: 7 },
                    { $sort: { date: 1 } } // Re-sort chronologically for chart
                ])
            ]);

            // Count distinct exams
            const distinctExams = await Attempt.distinct('examId', {
                userId: { $in: studentIds }
            });

            return {
                ...cls,
                studentsCount: studentIds.length,
                averageScore: globalStats.length > 0 ? Math.round(globalStats[0].averageScore * 10) / 10 : 0,
                examsCount: distinctExams.length,
                performanceHistory: performanceHistory.map((p: any) => ({
                    value: Math.round(p.value)
                }))
            };
        }));

        return classesWithStats;
    }

    /**
     * Get classes for a school
     */
    static async getSchoolClasses(schoolId: string) {
        return await Class.find({ school: schoolId })
            .populate('level', 'name code')
            .populate('mainTeacher', 'name')
            .sort({ name: 1 })
    }

    /**
     * Update a class
     */
    static async updateClass(classId: string, data: Partial<IClass>) {
        return await Class.findByIdAndUpdate(classId, data, { new: true })
    }

    /**
     * Delete a class
     */
    static async deleteClass(classId: string) {
        return await Class.findByIdAndDelete(classId)
    }

    /**
     * Get class by ID with details
     */
    static async getClassById(classId: string) {
        return await Class.findById(classId)
            .populate('level', 'name code')
            .populate('school', 'name')
            .populate('field', 'name code')
            .populate({ path: 'specialty', select: 'name code', strictPopulate: false })
            .populate('students', 'name email image isActive')
            .populate('mainTeacher', 'name')
    }

    /**
     * Get class statistics (Aggregation)
     */
    /**
     * Get class statistics (Aggregation)
     */
    static async getClassStats(classId: string) {
        const Attempt = mongoose.models.Attempt || mongoose.model('Attempt');
        const Exam = mongoose.models.Exam || mongoose.model('Exam');

        const classData = await this.getClassById(classId);
        if (!classData || !classData.students || classData.students.length === 0) {
            return {
                totalStudents: 0,
                averageScore: 0,
                attendanceRate: 0,
                examsCount: 0,
                performanceHistory: []
            };
        }

        const studentIds = classData.students.map((s: any) => s._id);

        // 1. Global Stats
        const globalStats = await Attempt.aggregate([
            {
                $match: {
                    userId: { $in: studentIds },
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    averageScore: { $avg: "$percentage" }, // Use percentage (0-100)
                    totalAttempts: { $sum: 1 }
                }
            }
        ]);

        // 2. Performance History (Avg score per exam, sorted by date)
        const performanceHistory = await Attempt.aggregate([
            {
                $match: {
                    userId: { $in: studentIds },
                    status: 'COMPLETED'
                }
            },
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $group: {
                    _id: "$exam._id",
                    title: { $first: "$exam.title" },
                    date: { $first: "$submittedAt" },
                    score: { $avg: "$percentage" }
                }
            },
            { $sort: { date: 1 } },
            { $limit: 10 } // Last 10 exams
        ]);

        // 3. Exams Count (Count distinct exams taken or targeted)
        // For now, count exams taken by at least one student
        const distinctExams = await Attempt.distinct('examId', {
            userId: { $in: studentIds }
        });

        // 4. Participation/Attendance (Approximate: Students with at least one attempt / Total Students)
        const activeStudents = await Attempt.distinct('userId', {
            userId: { $in: studentIds }
        });

        const attendanceRate = studentIds.length > 0
            ? Math.round((activeStudents.length / studentIds.length) * 100)
            : 0;

        return {
            totalStudents: classData.students.length,
            averageScore: globalStats.length > 0 ? Math.round(globalStats[0].averageScore * 10) / 10 : 0,
            attendanceRate,
            examsCount: distinctExams.length,
            performanceHistory: performanceHistory.map(p => ({
                name: p.title.substring(0, 15) + (p.title.length > 15 ? '...' : ''), // Truncate for chart
                score: Math.round(p.score * 10) / 10,
                fullDate: p.date
            }))
        };
    }

    /**
     * Get exams relevant for a class
     */
    static async getClassExams(classId: string) {
        const classData = await this.getClassById(classId);
        if (!classData) return [];

        const Exam = mongoose.models.Exam || mongoose.model('Exam');

        // Build query
        const query: any = {
            targetLevels: classData.level._id,
            status: { $ne: 'ARCHIVED' }
        };

        // Handle Fields filtering
        if (classData.field) {
            const fieldIds = [classData.field._id];
            if (classData.specialty) {
                fieldIds.push(classData.specialty._id);
            }

            query.$or = [
                { targetFields: { $exists: false } },
                { targetFields: { $size: 0 } },
                { targetFields: { $in: fieldIds } }
            ];
        } else {
            query.$or = [
                { targetFields: { $exists: false } },
                { targetFields: { $size: 0 } }
            ];
        }

        return await Exam.find(query)
            .populate('subject', 'name code')
            .populate('createdById', 'name')
            .sort({ startTime: -1 })
            .lean();
    }

    /**
     * Remove a student from a class
     */
    static async removeStudent(classId: string, studentId: string) {
        return await Class.findByIdAndUpdate(
            classId,
            { $pull: { students: studentId } },
            { new: true }
        );
    }

    /**
     * Get specific student stats for a class
     */
    static async getStudentClassStats(classId: string, studentId: string) {
        const Attempt = mongoose.models.Attempt || mongoose.model('Attempt');

        // 1. Get Class Data with all students
        const classData = await this.getClassById(classId);
        if (!classData) return null;

        // 2. Get all exams for this class
        const exams = await this.getClassExams(classId);
        const examIds = exams.map((e: any) => e._id);

        // 3. Get ALL attempts for ALL students in this class
        // Optimization: We could aggregate directly, but this allows flexible future logic
        const allAttempts = await Attempt.find({
            userId: { $in: classData.students.map((s: any) => s._id) },
            examId: { $in: examIds },
            status: 'COMPLETED'
        }).lean();

        // 4. Calculate stats for ALL students to determine rank
        const studentStats = classData.students.map((student: any) => {
            const studentAttempts = allAttempts.filter((a: any) => a.userId.toString() === student._id.toString());
            const avg = studentAttempts.length > 0
                ? studentAttempts.reduce((acc: number, curr: any) => acc + (curr.percentage || 0), 0) / studentAttempts.length
                : 0;
            return {
                studentId: student._id.toString(),
                average: avg
            };
        });

        // Sort by average (desc)
        studentStats.sort((a: any, b: any) => b.average - a.average);

        // Find Rank
        const rankIndex = studentStats.findIndex((s: any) => s.studentId === studentId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : 0; // 1-based rank

        // 5. Get Detailed Stats for the requested User
        const userAttempts = allAttempts.filter((a: any) => a.userId.toString() === studentId);
        const averageScore = studentStats.find((s: any) => s.studentId === studentId)?.average || 0;

        const totalExams = exams.length;
        const examsTaken = userAttempts.length;

        // 6. Detailed History
        const history = exams.map((exam: any) => {
            const attempt = userAttempts.find((a: any) => a.examId.toString() === exam._id.toString());
            return {
                examId: exam._id,
                title: exam.title,
                date: exam.startTime,
                status: attempt ? 'COMPLETED' : (new Date(exam.endTime) < new Date() ? 'MISSED' : 'PENDING'),
                score: attempt ? attempt.percentage : null
            };
        });

        return {
            student: classData.students.find((s: any) => s._id.toString() === studentId),
            averageScore: Math.round(averageScore * 10) / 10,
            participationRate: totalExams > 0 ? Math.round((examsTaken / totalExams) * 100) : 0,
            examsTaken,
            totalExams,
            history,
            rank,
            totalStudents: classData.students.length
        };
    }

    // ==========================================
    // CLASS VALIDATION METHODS (For School Admins)
    // ==========================================

    /**
     * Get pending classes for a school (for admin review)
     */
    static async getSchoolPendingClasses(schoolId: string) {
        return await Class.find({
            school: schoolId,
            validationStatus: ClassValidationStatus.PENDING
        })
            .populate('mainTeacher', 'name email')
            .populate('level', 'name code')
            .populate('field', 'name code')
            .populate({ path: 'specialty', select: 'name code', strictPopulate: false })
            .sort({ createdAt: -1 })
    }

    /**
     * Validate a class (approve by school admin)
     */
    static async validateClass(classId: string, adminId: string) {
        const { ClassRepository } = await import("@/lib/repositories/ClassRepository");
        const repo = new ClassRepository();
        return await repo.updateValidationStatus(classId, ClassValidationStatus.VALIDATED, adminId);
    }

    /**
     * Reject a class (reject by school admin)
     */
    static async rejectClass(classId: string, adminId: string, reason: string) {
        const { ClassRepository } = await import("@/lib/repositories/ClassRepository");
        const repo = new ClassRepository();
        return await repo.updateValidationStatus(classId, ClassValidationStatus.REJECTED, adminId, reason);
    }

    /**
     * Get all classes for a school with their validation status
     */
    static async getSchoolClassesWithValidation(schoolId: string, statusFilter?: ClassValidationStatus) {
        const { ClassRepository } = await import("@/lib/repositories/ClassRepository");
        const repo = new ClassRepository();
        return await repo.findBySchoolAndStatus(schoolId, statusFilter);
    }
}
