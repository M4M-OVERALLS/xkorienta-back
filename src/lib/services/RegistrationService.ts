import { RegistrationRepository } from "@/lib/repositories/RegistrationRepository";
import { UserRole, SchoolStatus } from "@/models/enums";
import bcrypt from "bcryptjs";

export class RegistrationService {
    private registrationRepository: RegistrationRepository;

    constructor() {
        this.registrationRepository = new RegistrationRepository();
    }

    async registerUser(data: any) {
        const { name, email, password, role, schoolId, classId, levelId, fieldId, subjects } = data;

        // 1. Check if user exists
        const existingUser = await this.registrationRepository.findUserByEmail(email);
        if (existingUser) {
            throw new Error("User already exists");
        }

        // 2. Role Validation
        if (!role || ![UserRole.STUDENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN].includes(role)) {
            throw new Error("Invalid role");
        }

        // 3. School Validation for TEACHER and SCHOOL_ADMIN
        if (role === UserRole.TEACHER || role === UserRole.SCHOOL_ADMIN) {
            if (!schoolId) {
                throw new Error("School selection is required");
            }

            const school = await this.registrationRepository.findSchoolById(schoolId);
            if (!school) {
                throw new Error("Selected school does not exist");
            }

            // For School Admin, school must be VALIDATED (partner)
            if (role === UserRole.SCHOOL_ADMIN && school.status !== SchoolStatus.VALIDATED) {
                throw new Error("Only validated partner schools can have administrators");
            }
        }

        // 4. Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.registrationRepository.createUser({
            name,
            email,
            password: hashedPassword,
            role,
            isActive: true,
            schools: schoolId ? [schoolId] : []
        });

        // 5. Handle Role Specific Logic
        if (role === UserRole.STUDENT) {
            const profile = await this.registrationRepository.createLearnerProfile({
                user: user._id,
                currentLevel: levelId,
                currentField: fieldId,
            });

            // Link profile to user
            user.learnerProfile = profile._id;

            // Enroll in class if selected
            if (classId) {
                await this.registrationRepository.enrollStudentInClass(classId, user._id.toString());
            }

        } else if (role === UserRole.TEACHER) {
            const profile = await this.registrationRepository.createPedagogicalProfile({
                user: user._id,
                teachingSubjects: subjects || [],
            });

            user.pedagogicalProfile = profile._id;

            // Add teacher to school's applicants list
            await this.registrationRepository.updateSchool(schoolId, {
                $addToSet: { applicants: user._id }
            });

        } else if (role === UserRole.SCHOOL_ADMIN) {
            const profile = await this.registrationRepository.createPedagogicalProfile({
                user: user._id,
                teachingSubjects: [],
            });

            user.pedagogicalProfile = profile._id;

            // Add directly to school's admins array
            await this.registrationRepository.updateSchool(schoolId, {
                $addToSet: { admins: user._id }
            });
        }

        await user.save();
        return user;
    }

    /**
     * Register user without role (for onboarding flow)
     * User will complete role selection during onboarding
     */
    async registerUserWithoutRole(data: { name: string; email: string; password: string }) {
        const { name, email, password } = data;

        // 1. Check if user exists
        const existingUser = await this.registrationRepository.findUserByEmail(email);
        if (existingUser) {
            throw new Error("User already exists");
        }

        // 2. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create user without role - will be set during onboarding
        const user = await this.registrationRepository.createUser({
            name,
            email,
            password: hashedPassword,
            // role will be undefined, set during onboarding
        });

        return user;
    }
}
