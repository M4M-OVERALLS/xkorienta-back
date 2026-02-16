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

        // Get school with teachers and applicants
        const school = await School.findById(schoolId)
            .select('teachers applicants')
            .lean();

        if (!school) {
            return { teachers: [], applicants: [] };
        }

        // Get approved teachers
        const teacherIds = school.teachers || [];
        const applicantIds = school.applicants || [];

        // Fetch teacher details
        const teachers = teacherIds.length > 0
            ? await User.find({
                _id: { $in: teacherIds },
                isActive: true
            }).select('name email role isActive metadata.avatar lastLogin createdAt subjects').populate('subjects', 'name').lean()
            : [];

        // Fetch applicant details
        const applicants = applicantIds.length > 0
            ? await User.find({
                _id: { $in: applicantIds },
                isActive: true
            }).select('name email role isActive metadata.avatar lastLogin createdAt subjects').populate('subjects', 'name').lean()
            : [];

        return {
            teachers: teachers.map(t => ({ ...t, status: 'APPROVED' })),
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
