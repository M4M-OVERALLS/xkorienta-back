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
}
