import Class from "@/models/Class";
import School from "@/models/School";
import Syllabus from "@/models/Syllabus";
import User from "@/models/User";
import connectDB from "@/lib/mongodb";

export class TeacherRepository {
    /**
     * Get class IDs where teacher is mainTeacher
     */
    async findMainTeacherClassIds(teacherId: string): Promise<string[]> {
        await connectDB();
        const classIds = await Class.find({
            mainTeacher: teacherId,
            isActive: true
        }).distinct('_id');

        return classIds.map(id => id.toString());
    }

    /**
     * Get class IDs from teacher's syllabuses
     */
    async findSyllabusClassIds(teacherId: string): Promise<string[]> {
        await connectDB();
        const syllabuses = await Syllabus.find({
            teacher: teacherId
        }).select('classes').lean();

        const classIds = syllabuses.flatMap(s => s.classes || []);
        return classIds.map(id => id.toString());
    }

    /**
     * Get classes with populated students
     */
    async findClassesWithStudents(classIds: string[], classIdFilter?: string) {
        await connectDB();
        const query: Record<string, unknown> = {
            _id: { $in: classIds },
            isActive: true
        };

        if (classIdFilter) {
            query._id = classIdFilter;
        }

        return Class.find(query)
            .populate('students', 'name email image studentCode createdAt')
            .populate('level', 'name')
            .select('name students level')
            .lean();
    }

    /**
     * Find teachers by school ID (includes applicants)
     */
    async findTeachersBySchool(schoolId: string) {
        await connectDB();

        // Get school with teachers and applicants arrays
        const school = await School.findById(schoolId)
            .select('teachers applicants')
            .lean();

        if (!school) {
            return { teachers: [], applicants: [] };
        }

        const schoolTeacherIds = (school.teachers || []).map((id: any) => id.toString());
        const applicantIds = school.applicants || [];

        // Also find users who have this school in their user.schools array
        // (covers cases where user.schools and school.teachers are out of sync)
        const usersWithSchool = await User.find({
            schools: schoolId,
            _id: { $nin: applicantIds },
        }).select('name email role isActive metadata.avatar lastLogin createdAt').lean();

        // Merge: school.teachers list + users who have the school in their profile
        const teacherMap = new Map<string, any>();
        // First add users found via user.schools
        for (const u of usersWithSchool) {
            teacherMap.set(u._id.toString(), { ...u, status: 'APPROVED' });
        }
        // Then fetch those explicitly in school.teachers (may overlap)
        if (schoolTeacherIds.length > 0) {
            const explicit = await User.find({
                _id: { $in: schoolTeacherIds },
            }).select('name email role isActive metadata.avatar lastLogin createdAt').lean();
            for (const u of explicit) {
                teacherMap.set(u._id.toString(), { ...u, status: 'APPROVED' });
            }
        }

        // Also add mainTeachers of school classes who might not be in either list
        const classTeachers = await Class.find({ school: schoolId, mainTeacher: { $ne: null } })
            .select('mainTeacher')
            .lean();
        const mainTeacherIds = classTeachers
            .map((c: any) => c.mainTeacher?.toString())
            .filter((id: string | undefined): id is string => !!id && !teacherMap.has(id));
        if (mainTeacherIds.length > 0) {
            const mts = await User.find({ _id: { $in: mainTeacherIds } })
                .select('name email role isActive metadata.avatar lastLogin createdAt').lean();
            for (const u of mts) {
                teacherMap.set(u._id.toString(), { ...u, status: 'APPROVED' });
            }
        }

        // Remove applicants from the teachers map
        const applicantIdSet = new Set(applicantIds.map((id: any) => id.toString()));
        for (const id of applicantIdSet) {
            teacherMap.delete(id);
        }

        // Fetch applicant details
        const applicants = applicantIds.length > 0
            ? await User.find({
                _id: { $in: applicantIds },
            }).select('name email role isActive metadata.avatar lastLogin createdAt').lean()
            : [];

        return {
            teachers: Array.from(teacherMap.values()),
            applicants: applicants.map(a => ({ ...a, status: 'PENDING' }))
        };
    }

    /**
     * Find teacher IDs by school ID (for stats)
     */
    async findTeacherIdsBySchool(schoolId: string): Promise<string[]> {
        await connectDB();
        const teachers = await User.find({
            schools: schoolId,
            role: 'TEACHER',
            isActive: true
        }).select('_id').lean();

        return teachers.map(t => t._id.toString());
    }
}
