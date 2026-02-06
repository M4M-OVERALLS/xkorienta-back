import School, { ISchool } from "@/models/School";
import { SchoolStatus } from "@/models/enums";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import SchoolScore from "@/models/SchoolScore";

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
     * Find schools where user is owner, teacher, admin, or applicant (pending approval)
     */
    async findByTeacher(teacherId: string) {
        await connectDB();
        const schools = await School.find({
            $or: [
                { owner: teacherId },
                { teachers: teacherId },
                { admins: teacherId },
                { applicants: teacherId }
            ]
        }).select('name type logoUrl status address applicants').lean();

        // Add isPending flag for schools where user is an applicant
        return schools.map((school: any) => {
            const isPending = school.applicants?.some((id: any) => id.toString() === teacherId);
            const { applicants, ...schoolData } = school;
            return {
                ...schoolData,
                isPending: !!isPending
            };
        });
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
     * Find schools for student list (no backend filters).
     */
    async findSchoolsForStudents() {
        await connectDB();
        const schools = await School.find({})
            .select([
                'name',
                'type',
                'address',
                'city',
                'country',
                'logoUrl',
                'status',
                'contactInfo',
                'specialties',
                'accreditation',
                'tuitionFee',
                'modality',
                'Languages',
                'badges',
                'academicLevel',
                'degrees',
                'partnerships',
                'studentCount',
                'foundedYear',
                'description',
                'learningOutcomes',
                'careerPaths'
            ].join(' '))
            .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'country', select: 'name isoCode currency', options: { strictPopulate: false } })
            .populate({ path: 'specialties', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'accreditation', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'badges.certification', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'academicLevel', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'partnerships', select: 'name', options: { strictPopulate: false } })
            .populate({ path: 'careerPaths', select: 'title salary demand', options: { strictPopulate: false } })
            .sort({ name: 1 })
            .lean();

        const schoolIds = schools.map(s => s._id as mongoose.Types.ObjectId);
        const scores = await SchoolScore.find({ school: { $in: schoolIds } })
            .select('school globalScore')
            .lean();

        const scoreBySchoolId = new Map<string, number>();
        for (const score of scores) {
            const scoreData = score as unknown as { school: { toString: () => string }, globalScore: number };
            scoreBySchoolId.set(scoreData.school.toString(), scoreData.globalScore);
        }

        return schools.map((s) => {
            const id = (s._id as { toString: () => string }).toString();
            return {
                ...s,
                xkorientaScore: scoreBySchoolId.get(id)
            };
        });
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
