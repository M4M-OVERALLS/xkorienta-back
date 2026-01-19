import School from "@/models/School";
import { SchoolStatus } from "@/models/enums";
import connectDB from "@/lib/mongodb";

export class SchoolRepository {
    async findActiveSchools(search?: string, type?: string) {
        await connectDB();
        const query: any = { isActive: true };

        if (type) {
            query.type = type;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        return School.find(query)
            .populate('admins', 'name email')
            .sort({ name: 1 })
            .lean();
    }

    async isSchoolAdmin(schoolId: string, userId: string): Promise<boolean> {
        await connectDB();
        const school = await School.findOne({
            _id: schoolId,
            admins: userId
        }).select('_id');

        return !!school;
    }

    async findByAdmin(adminId: string) {
        await connectDB();
        return School.find({ admins: adminId }).select('_id name');
    }

    async updateValidationStatus(id: string, isValidated: boolean, adminId: string, status?: SchoolStatus) {
        await connectDB();
        const updateData: any = {
            isValidated,
            validatedBy: adminId,
            validatedAt: new Date()
        };

        if (status) {
            updateData.status = status;
        }

        return School.findByIdAndUpdate(id, updateData, { new: true });
    }
}
