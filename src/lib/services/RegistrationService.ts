import { RegistrationRepository } from "@/lib/repositories/RegistrationRepository";
import { UserRole, SchoolStatus } from "@/models/enums";
import bcrypt from "bcryptjs";
import School from "@/models/School";
import mongoose from "mongoose";

export class RegistrationService {
    private registrationRepository: RegistrationRepository;

    constructor() {
        this.registrationRepository = new RegistrationRepository();
    }

    async registerUser(data: any) {
        const { name, email, password, role, schoolId, classId, levelId, fieldId, subjects, newSchoolData, isCreatingSchool } = data;

        // 1. Check if user exists
        const existingUser = await this.registrationRepository.findUserByEmail(email);
        if (existingUser) {
            throw new Error("User already exists");
        }

        // 2. Role Validation
        if (!role || ![UserRole.STUDENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN].includes(role)) {
            throw new Error("Invalid role");
        }

        let finalSchoolId = schoolId;
        let createdSchool = null;

        // 3. Handle School Creation for TEACHER
        if (role === UserRole.TEACHER && isCreatingSchool && newSchoolData) {
            // Create the new school with teacher as owner
            createdSchool = await School.create({
                name: newSchoolData.name,
                type: newSchoolData.type || "PUBLIC",
                address: newSchoolData.address,
                city: newSchoolData.city,
                country: newSchoolData.country,
                status: SchoolStatus.PENDING, // New schools need validation by QuizLock admin
                isActive: true,
                owner: null, // Will be set after user creation
                teachers: [], // Will be set after user creation
                admins: [],
                applicants: []
            });
            
            finalSchoolId = createdSchool._id.toString();
        }

        // 4. School Validation for TEACHER (existing school) and SCHOOL_ADMIN
        if ((role === UserRole.TEACHER && !isCreatingSchool) || role === UserRole.SCHOOL_ADMIN) {
            if (!finalSchoolId) {
                throw new Error("School selection is required");
            }

            const school = await this.registrationRepository.findSchoolById(finalSchoolId);
            if (!school) {
                throw new Error("Selected school does not exist");
            }

            // For School Admin, school must be VALIDATED (partner)
            if (role === UserRole.SCHOOL_ADMIN && school.status !== SchoolStatus.VALIDATED) {
                throw new Error("Only validated partner schools can have administrators");
            }
        }

        // 5. Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.registrationRepository.createUser({
            name,
            email,
            password: hashedPassword,
            role,
            isActive: true,
            schools: finalSchoolId ? [finalSchoolId] : []
        });

        // 6. Handle School Creation Post-User (set owner)
        if (createdSchool) {
            await School.findByIdAndUpdate(createdSchool._id, {
                owner: user._id,
                teachers: [user._id], // Teacher is immediately official
                admins: [user._id]
            });
        }

        // 7. Handle Role Specific Logic
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

            if (isCreatingSchool && createdSchool) {
                // Teacher created their own school - they are already owner and official teacher
                // No need to add to applicants
                console.log(`[Registration] Teacher ${user._id} created school ${createdSchool._id} and is now owner`);
            } else {
                // Teacher selected existing school - add to applicants
                await this.registrationRepository.updateSchool(finalSchoolId, {
                    $addToSet: { applicants: user._id }
                });
            }

        } else if (role === UserRole.SCHOOL_ADMIN) {
            const profile = await this.registrationRepository.createPedagogicalProfile({
                user: user._id,
                teachingSubjects: [],
            });

            user.pedagogicalProfile = profile._id;

            // Add directly to school's admins array
            await this.registrationRepository.updateSchool(finalSchoolId, {
                $addToSet: { admins: user._id }
            });
        }

        await user.save();
        
        // Return user with created school info if applicable
        const result: any = user.toObject();
        if (createdSchool) {
            result.createdSchool = createdSchool.toObject();
        }
        
        return result;
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
