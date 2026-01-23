import Class, { IClass } from "@/models/Class";
import { ClassValidationStatus } from "@/models/enums";
import connectDB from "@/lib/mongodb";

export class ClassRepository {
    async findById(id: string): Promise<IClass | null> {
        await connectDB();
        return Class.findById(id).populate('school').lean();
    }

    async updateValidationStatus(
        id: string,
        status: ClassValidationStatus,
        adminId: string,
        reason?: string
    ): Promise<IClass | null> {
        await connectDB();
        return Class.findByIdAndUpdate(
            id,
            {
                validationStatus: status,
                validatedBy: adminId,
                validatedAt: new Date(),
                rejectionReason: reason || null
            },
            { new: true }
        ).populate('school');
    }

    async findBySchoolAndStatus(schoolId: string, status?: ClassValidationStatus) {
        await connectDB();
        const query: any = { school: schoolId };
        if (status) {
            query.validationStatus = status;
        }

        return Class.find(query)
            .populate('mainTeacher', 'name email')
            .populate('level', 'name code')
            .populate('field', 'name code')
            .populate({ path: 'specialty', select: 'name code', strictPopulate: false })
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Find active class where student is enrolled
     */
    async findStudentClass(studentId: string) {
        await connectDB();
        return Class.findOne({
            students: studentId,
            isActive: true
        }).populate('school').populate('level').lean();
    }

    /**
     * Find all classes where student is enrolled
     */
    async findStudentClasses(studentId: string) {
        await connectDB();
        return Class.find({
            students: studentId
        })
            .populate('level')
            .populate('field')
            .populate('specialty')
            .lean();
    }

    /**
     * Find all active classes where student is enrolled
     */
    async findActiveStudentClasses(studentId: string) {
        await connectDB();
        return Class.find({
            students: studentId,
            isActive: true
        })
            .populate('school', 'name logoUrl')
            .populate('level', 'name')
            .populate('field', 'name')
            .populate('mainTeacher', 'name')
            .lean();
    }

    /**
     * Find classes by school ID with populated students and level
     */
    async findBySchoolWithDetails(schoolId: string) {
        await connectDB();
        return Class.find({ school: schoolId })
            .populate('students', 'name')
            .populate('level', 'name')
            .lean();
    }

    /**
     * Find classes by school ID with all necessary populate for school classes list
     */
    async findBySchool(schoolId: string) {
        await connectDB();
        return Class.find({ school: schoolId })
            .populate('mainTeacher', 'name email')
            .populate('level', 'name')
            .populate('specialty', 'name')
            .populate('field', 'code name')
            .select('name level specialty field academicYear students mainTeacher')
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Find classes by teacher ID
     */
    async findByTeacher(teacherId: string) {
        await connectDB();
        return Class.find({ mainTeacher: teacherId }).select('_id').lean();
    }

    /**
     * Find classes by teacher ID with students
     */
    async findByTeacherWithStudents(teacherId: string) {
        await connectDB();
        return Class.find({ mainTeacher: teacherId }).select('students').lean();
    }
}
