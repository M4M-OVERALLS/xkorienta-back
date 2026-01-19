import School, { ISchool } from "@/models/School";
import User, { IUser } from "@/models/User";
import Class from "@/models/Class";
import Attempt from "@/models/Attempt";
import Exam from "@/models/Exam";
import mongoose from "mongoose";

export class SchoolService {

    /**
     * Get School Stats
     * Returns: Total Students, Total Teachers, Active Classes, Average Score
     */
    static async searchSchools(search?: string, type?: string) {
        const query: any = { isActive: true };

        if (type) {
            query.type = type;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // TODO: Move query logic to SchoolRepository completely
        return School.find(query)
            .populate('admins', 'name email')
            .sort({ name: 1 })
            .lean();
    }
    static async getSchoolStats(schoolId: string) {
        // 1. Basic Counts
        const school = await School.findById(schoolId).select('-teachers -admins');
        if (!school) return null;

        // Count teachers reliably and get their IDs
        const schoolTeachers = await User.find({
            schools: schoolId,
            role: 'TEACHER',
            isActive: true
        }).select('_id');

        const teachersCount = schoolTeachers.length;
        const teacherIds = schoolTeachers.map(t => t._id);

        // Count admins reliably
        // Assuming admins rely on similar logic or we keep the school array if no better way.
        // But for consistency let's try to query Users if they have ADMIN role and are in this school?
        // Actually, admins are often stored in school.admins too. Let's fallback to User query if possible.
        // Assuming 'SCHOOL_ADMIN' role or similar. If not sure, let's keep array for admins but fix teachers.
        // Let's stick to array for admins for now as getSchoolTeachers query is specific.
        const adminsCount = await School.findById(schoolId).select('admins').then(s => s?.admins.length || 0);

        const classes = await Class.find({ school: new mongoose.Types.ObjectId(schoolId) })
            .populate('students', 'name')
            .populate('level', 'name');
        const classesCount = classes.length;

        console.log(`[SchoolStats] Found ${classesCount} classes for school ${schoolId}`); // Debug log

        // 2. Students Count (Unique students across all classes)
        const allStudents = classes.flatMap((c: any) => c.students);
        const uniqueStudentsMap = new Map();
        allStudents.forEach((student: any) => {
            if (student && student._id) {
                uniqueStudentsMap.set(student._id.toString(), student);
            }
        });
        const studentsCount = uniqueStudentsMap.size;
        const studentIds = Array.from(uniqueStudentsMap.keys());

        // 3. Get class IDs for exam queries
        // const classIds = classes.map((c: any) => c._id); // Removed as per instruction

        // 4. Count exams created by school teachers
        const examsCount = await Exam.countDocuments({
            createdById: { $in: teacherIds },
            status: { $in: ['ACTIVE', 'COMPLETED', 'PUBLISHED', 'VALIDATED'] } // Include PUBLISHED/VALIDATED
        });

        // 5. Calculate average score & get performance data
        let averageScore = 0;
        let scoreDistribution = [
            { range: '0-20%', count: 0, color: '#ef4444' },
            { range: '21-40%', count: 0, color: '#f97316' },
            { range: '41-60%', count: 0, color: '#eab308' },
            { range: '61-80%', count: 0, color: '#3b82f6' },
            { range: '81-100%', count: 0, color: '#22c55e' },
        ];
        let recentPerformance: any[] = [];

        if (studentIds.length > 0) {
            // Get average score
            const avgStats = await Attempt.aggregate([
                {
                    $match: {
                        userId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
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
            averageScore = avgStats.length > 0 ? avgStats[0].avg : 0;

            // Get score distribution
            const distribution = await Attempt.aggregate([
                {
                    $match: {
                        userId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
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

            // Map distribution to our format
            distribution.forEach((bucket: any) => {
                if (bucket._id === 0) scoreDistribution[0].count = bucket.count;
                else if (bucket._id === 20) scoreDistribution[1].count = bucket.count;
                else if (bucket._id === 40) scoreDistribution[2].count = bucket.count;
                else if (bucket._id === 60) scoreDistribution[3].count = bucket.count;
                else if (bucket._id === 80) scoreDistribution[4].count = bucket.count;
            });

            // Get weekly performance trend (last 8 weeks)
            const eightWeeksAgo = new Date();
            eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

            const weeklyPerformance = await Attempt.aggregate([
                {
                    $match: {
                        userId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
                        status: 'COMPLETED',
                        submittedAt: { $gte: eightWeeksAgo }
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
                { $limit: 8 }
            ]);

            // Transform to chart format
            const weekNames = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
            recentPerformance = weeklyPerformance.map((w: any, i: number) => ({
                name: weekNames[i] || `S${i + 1}`,
                score: Math.round(w.avgScore * 10) / 10,
                exams: w.count
            }));

            // If no data, provide sample structure
            if (recentPerformance.length === 0) {
                recentPerformance = weekNames.slice(0, 4).map(name => ({
                    name,
                    score: 0,
                    exams: 0
                }));
            }
        }

        // 6. Get recent activity (last 5 exam results created by these teachers)
        const recentExams = await Exam.find({
            createdById: { $in: teacherIds },
            status: { $nin: ['DRAFT', 'ARCHIVED'] } // Show non-draft/archived
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title subject startTime status')
            .populate('subject', 'name');

        // 7. Calculate class distribution by level
        const classDistribution = classes.reduce((acc: any[], cls: any) => {
            const levelName = cls.level?.name || 'Non défini';
            const existing = acc.find(item => item.name === levelName);
            if (existing) {
                existing.value += 1;
            } else {
                acc.push({ name: levelName, value: 1 });
            }
            return acc;
        }, []);

        // 8. Calculate completion rate
        const totalAttempts = await Attempt.countDocuments({
            userId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) }
        });
        const completedAttempts = await Attempt.countDocuments({
            userId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: 'COMPLETED'
        });
        const completionRate = totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0;

        return {
            details: school,
            stats: {
                totalStudents: studentsCount,
                totalTeachers: teachersCount,
                adminsCount,
                activeClasses: classesCount,
                examsCount,
                averageScore: Math.round(averageScore * 10) / 10,
                completionRate
            },
            charts: {
                scoreDistribution,
                recentPerformance,
                classDistribution,
                recentExams: recentExams.map((e: any) => ({
                    id: e._id,
                    title: e.title,
                    subject: e.subject?.name || 'N/A',
                    date: e.startTime,
                    status: e.status
                }))
            }
        };
    }

    /**
     * Get Teachers List
     */
    static async getSchoolTeachers(schoolId: string) {
        // Find all users who have this school in their schools array
        const teachers = await User.find({
            schools: schoolId,
            role: 'TEACHER',
            isActive: true
        }).select('name email role isActive metadata.avatar lastLogin createdAt');

        return teachers;
    }

    /**
     * Add Teacher to School
     */
    static async addTeacherToSchool(schoolId: string, userId: string) {
        return await School.findByIdAndUpdate(
            schoolId,
            { $addToSet: { teachers: userId } },
            { new: true }
        );
    }

    /**
     * Remove Teacher from School
     */
    static async removeTeacherFromSchool(schoolId: string, userId: string) {
        // Also remove school from user?
        await User.findByIdAndUpdate(userId, { $pull: { schools: schoolId } });

        return await School.findByIdAndUpdate(
            schoolId,
            { $pull: { teachers: userId } },
            { new: true }
        );
    }

    /**
     * Get Public Schools (for discovery)
     */
    static async getPublicSchools() {
        return await School.find({
            status: 'APPROVED',
            isActive: true
        })
            .select('name type address logoUrl contactInfo createdAt applicants')
            .sort({ name: 1 })
            .limit(20);
    }

    /**
     * Get Teacher's Schools (Owned or Member)
     */
    static async getTeacherSchools(userId: string) {
        // Find schools where user is owner or in teachers list
        return await School.find({
            $or: [
                { owner: userId },
                { teachers: userId },
                { admins: userId }
            ]
        }).select('name type logoUrl status type address');
    }

    /**
     * Get School Classes
     */
    static async getSchoolClasses(schoolId: string) {
        return await Class.find({ school: schoolId })
            .populate('mainTeacher', 'name email') // Main teacher
            .populate('level', 'name')
            .populate('specialty', 'name')
            .populate('field', 'code name')
            .select('name level specialty field academicYear students mainTeacher')
            .sort({ name: 1 });
    }

    // ==========================================
    // TEACHER APPROVAL METHODS (For School Admins)
    // ==========================================

    /**
     * Get pending teacher applications for a school
     */
    static async getPendingTeachers(schoolId: string) {
        const school = await School.findById(schoolId)
            .populate('applicants', 'name email createdAt metadata.avatar')
            .select('applicants');

        return school?.applicants || [];
    }

    /**
     * Approve a teacher application
     */
    static async approveTeacher(schoolId: string, teacherId: string) {
        // Move from applicants to teachers
        const school = await School.findByIdAndUpdate(
            schoolId,
            {
                $pull: { applicants: teacherId },
                $addToSet: { teachers: teacherId }
            },
            { new: true }
        );

        // Add school to teacher's schools list
        await User.findByIdAndUpdate(teacherId, {
            $addToSet: { schools: schoolId }
        });

        return school;
    }

    /**
     * Reject a teacher application
     */
    static async rejectTeacher(schoolId: string, teacherId: string) {
        // Remove from applicants
        const school = await School.findByIdAndUpdate(
            schoolId,
            { $pull: { applicants: teacherId } },
            { new: true }
        );

        // Remove school from teacher's schools list
        await User.findByIdAndUpdate(teacherId, {
            $pull: { schools: schoolId }
        });

        return school;
    }

    static async validateSchool(schoolId: string, adminId: string, status?: any): Promise<ISchool | null> {
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();

        const school = await schoolRepo.updateValidationStatus(schoolId, true, adminId, status);

        if (!school) {
            throw new Error("School not found");
        }

        return school;
    }

    /**
     * Verify if user is admin of the school
     */
    static async verifySchoolAdmin(schoolId: string, userId: string): Promise<boolean> {
        // We import the repository dynamically to avoid circular dependencies if any, 
        // or just import at top if safe. 
        // For now, let's just use the repository pattern as requested.
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();
        return await schoolRepo.isSchoolAdmin(schoolId, userId);
    }

    /**
     * Get schools where user is admin
     */
    static async getAdminSchools(userId: string) {
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();
        return await schoolRepo.findByAdmin(userId);
    }
}

