import School, { ISchool } from "@/models/School";
import { SchoolStatus } from "@/models/enums";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class SchoolRepository {
    /**
     * Find school by ID
     */
    async findById(id: string): Promise<ISchool | null> {
        await connectDB();
        return School.findById(id);
    }

    async findActiveSchools(search?: string, type?: string) {
        await connectDB();
        const query: Record<string, unknown> = { isActive: true };

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
        const updateData: Record<string, unknown> = {
            isValidated,
            validatedBy: adminId,
            validatedAt: new Date()
        };

        if (status) {
            updateData.status = status;
        }

        return School.findByIdAndUpdate(id, updateData, { new: true });
    }

    /**
     * Find schools where user is owner, teacher, or admin
     */
    async findByTeacher(teacherId: string) {
        await connectDB();
        return School.find({
            $or: [
                { owner: teacherId },
                { teachers: teacherId },
                { admins: teacherId }
            ]
        }).select('name type logoUrl status address').lean();
    }

    /**
     * Find validated schools for orientation (student orientation flow)
     */
    async findValidatedSchoolsForOrientation(search?: string) {
        await connectDB();
        const query: Record<string, unknown> = {
            status: SchoolStatus.VALIDATED,
            isActive: true
        };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        return School.find(query)
            .select('name type address logoUrl status contactInfo')
            .sort({ name: 1 })
            .limit(50)
            .lean();
    }

    /**
     * Check if user is a member of the school (teacher, admin, or owner)
     */
    async isUserMember(schoolId: string, userId: string): Promise<boolean> {
        await connectDB();
        const school = await School.findById(schoolId).select('teachers admins owner');
        if (!school) return false;

        const schoolData = school as unknown as Record<string, unknown>;
        const teachers = schoolData.teachers as Array<{ toString: () => string }> | undefined;
        const admins = schoolData.admins as Array<{ toString: () => string }> | undefined;
        const owner = schoolData.owner as { toString: () => string } | undefined;

        const isTeacher = teachers?.some(id => id.toString() === userId) || false;
        const isAdmin = admins?.some(id => id.toString() === userId) || false;
        const isOwner = owner?.toString() === userId;

        return isTeacher || isAdmin || isOwner;
    }

    /**
     * Check if user has already applied to the school
     */
    async isUserApplicant(schoolId: string, userId: string): Promise<boolean> {
        await connectDB();
        const school = await School.findById(schoolId).select('applicants');
        if (!school) return false;

        const schoolData = school as unknown as Record<string, unknown>;
        const applicants = schoolData.applicants as Array<{ toString: () => string }> | undefined;

        return applicants?.some(id => id.toString() === userId) || false;
    }

    /**
     * Add user to applicants list
     */
    async addApplicant(schoolId: string, userId: string): Promise<ISchool | null> {
        await connectDB();
        const school = await School.findById(schoolId);
        if (!school) return null;

        // Initialize applicants array if it doesn't exist
        if (!school.applicants) {
            school.applicants = [];
        }

        // Check if already in applicants
        const userIdStr = userId;
        const alreadyApplied = school.applicants.some((id: unknown) => {
            const idObj = id as { toString: () => string };
            return idObj.toString() === userIdStr;
        });

        if (alreadyApplied) {
            return school;
        }

        // Add user to applicants
        school.applicants.push(new mongoose.Types.ObjectId(userId));
        
        return school.save();
    }

    /**
     * Get admins count for a school
     */
    async getAdminsCount(schoolId: string): Promise<number> {
        await connectDB();
        const school = await School.findById(schoolId).select('admins');
        return school?.admins?.length || 0;
    }

    /**
     * Find school by ID without populating teachers and admins
     */
    async findByIdBasic(schoolId: string): Promise<ISchool | null> {
        await connectDB();
        return School.findById(schoolId).select('-teachers -admins');
    }
}
