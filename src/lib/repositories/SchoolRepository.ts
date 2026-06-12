import School, { ISchool } from "@/models/School";
import { SchoolStatus } from "@/models/enums";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import SchoolScore from "@/models/SchoolScore";

// Import models to ensure they are registered for populate
import "@/models/City";
import "@/models/Country";
import "@/models/Specialty";
import "@/models/Badge";
import "@/models/EducationLevel";
import "@/models/Partner";
import "@/models/CareerOutcome";

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
        // Only expose VALIDATED schools publicly — PENDING/REJECTED/SUSPENDED must never appear in search
        const query: Record<string, unknown> = {
            status: SchoolStatus.VALIDATED,
            isActive: true
        };

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

    async updateValidationStatus(
        id: string,
        status: SchoolStatus,
        adminId: string,
        rejectionNotes?: string
    ): Promise<ISchool | null> {
        await connectDB();
        const updateData: Record<string, unknown> = {
            status,
            verifiedBy: adminId,
            verifiedAt: new Date()
        };

        if (rejectionNotes !== undefined) {
            updateData.rejectionNotes = rejectionNotes;
        }

        return School.findByIdAndUpdate(id, updateData, { new: true });
    }

    /**
     * List schools by status for the admin panel (paginated)
     */
    async findByStatus(
        status: SchoolStatus | "ALL",
        page = 1,
        limit = 20,
        search?: string
    ): Promise<{ schools: ISchool[]; total: number }> {
        await connectDB();
        const query: Record<string, unknown> = {};

        if (status !== "ALL") {
            query.status = status;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const skip = (page - 1) * limit;
        const [schools, total] = await Promise.all([
            School.find(query)
                .populate('owner', 'name email')
                .populate('verifiedBy', 'name email')
                .select('name type address city status owner verifiedBy verifiedAt rejectionNotes createdAt logoUrl')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            School.countDocuments(query)
        ]);

        return { schools: schools as unknown as ISchool[], total };
    }

    /**
     * Find schools where user is owner, teacher, admin, or applicant (pending approval)
     */
    async findByTeacher(teacherId: string) {
        await connectDB();
        const oid = new mongoose.Types.ObjectId(teacherId);
        const schools = await School.find({
            $or: [
                { owner: oid },
                { teachers: oid },
                { admins: oid },
                { applicants: oid }
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

        const SELECTED_FIELDS = [
            'name', 'type', 'address', 'city', 'country', 'logoUrl', 'status',
            'contactInfo', 'specialties', 'accreditation', 'tuitionFee', 'modality',
            'Languages', 'badges', 'academicLevel', 'degrees', 'partnerships',
            'studentCount', 'foundedYear', 'description', 'learningOutcomes', 'careerPaths'
        ].join(' ');

        // Populates qui ne risquent pas de CastError (toujours des ObjectId ou des arrays d'ObjectId)
        const safePopulates = [
            { path: 'specialties', select: 'name', options: { strictPopulate: false } },
            { path: 'accreditation', select: 'name', options: { strictPopulate: false } },
            { path: 'badges.certification', select: 'name', options: { strictPopulate: false } },
            { path: 'academicLevel', select: 'name', options: { strictPopulate: false } },
            { path: 'partnerships', select: 'name', options: { strictPopulate: false } },
            { path: 'careerPaths', select: 'title salary demand', options: { strictPopulate: false } },
        ];

        // Students only see verified schools — never expose PENDING/REJECTED/SUSPENDED
        // city/country peuvent contenir des strings au lieu d'ObjectId dans certains documents
        // (données migrées). On les populate séparément avec un filtre ObjectId.
        let query = School.find({ status: SchoolStatus.VALIDATED, isActive: true })
            .select(SELECTED_FIELDS);

        for (const pop of safePopulates) {
            query = query.populate(pop);
        }

        const schools = await query.sort({ name: 1 }).lean();

        // Populate manuel city/country : ne tenter que si la valeur est un ObjectId valide
        const isObjectId = (v: unknown): v is mongoose.Types.ObjectId =>
            mongoose.isValidObjectId(v) && typeof v !== 'string';

        const cityIds = [...new Set(schools.filter(s => isObjectId(s.city)).map(s => s.city!.toString()))];
        const countryIds = [...new Set(schools.filter(s => isObjectId(s.country)).map(s => s.country!.toString()))];

        const [cities, countries] = await Promise.all([
            cityIds.length > 0
                ? mongoose.model('City').find({ _id: { $in: cityIds } }).select('name').lean()
                : Promise.resolve([]),
            countryIds.length > 0
                ? mongoose.model('Country').find({ _id: { $in: countryIds } }).select('name isoCode currency').lean()
                : Promise.resolve([]),
        ]);

        const cityMap = new Map(cities.map((c: any) => [c._id.toString(), c]));
        const countryMap = new Map(countries.map((c: any) => [c._id.toString(), c]));

        for (const school of schools as any[]) {
            if (isObjectId(school.city)) {
                school.city = cityMap.get(school.city.toString()) ?? school.city;
            }
            if (isObjectId(school.country)) {
                school.country = countryMap.get(school.country.toString()) ?? school.country;
            }
            // Si c'est une string ("Cameroun", "Douala"), on la laisse telle quelle
        }

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
