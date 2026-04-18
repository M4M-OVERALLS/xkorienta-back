import { RegistrationRepository } from "@/lib/repositories/RegistrationRepository";
import { UserRole, SchoolStatus } from "@/models/enums";
import bcrypt from "bcryptjs";
import School from "@/models/School";
import mongoose from "mongoose";
import { UnverifiedSchoolService, DeclaredSchoolData } from "./UnverifiedSchoolService";

export class RegistrationService {
    private registrationRepository: RegistrationRepository;

    constructor() {
        this.registrationRepository = new RegistrationRepository();
    }

    async registerUser(data: any) {
        const {
            name, email, phone, password, role, schoolId, classId, levelId, fieldId,
            subjects, newSchoolData, isCreatingSchool,
            // Champs hérités (ancienne API)
            declaredSchoolName,
            // Nouvelle API inscription autonome
            declaredSchoolData, // { name, city?, country?, type? }
            skipSchool          // true => inscription sans école
        } = data;

        // 1. Validate identifiers — at least email OR phone required
        if (!email && !phone) {
            throw new Error("Email ou numéro de téléphone requis");
        }

        // For non-student roles, email remains mandatory
        if (role !== UserRole.STUDENT && !email) {
            throw new Error("L'email est requis pour ce type de compte");
        }

        // 2. Check if user already exists (by email or phone)
        if (email) {
            const byEmail = await this.registrationRepository.findUserByIdentifier({ email });
            if (byEmail) {
                throw new Error("Un compte existe déjà avec cet email");
            }
        }
        if (phone) {
            const byPhone = await this.registrationRepository.findUserByIdentifier({ phone });
            if (byPhone) {
                throw new Error("Ce numéro de téléphone est déjà utilisé");
            }
        }

        // 3. Role Validation
        if (!role || ![UserRole.STUDENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN].includes(role)) {
            throw new Error("Invalid role");
        }

        // 3. School Validation — now flexible per role
        //    STUDENT: school is optional (can auto-declare or skip)
        //    TEACHER: can skip school entirely (Classe Libre)
        //    SCHOOL_ADMIN: can select existing OR create new school (auto-référencement)
        if (role === UserRole.TEACHER && !isCreatingSchool && !skipSchool && schoolId) {
            const school = await this.registrationRepository.findSchoolById(schoolId);
            if (!school) {
                throw new Error("Selected school does not exist");
            }
        }

        if (role === UserRole.SCHOOL_ADMIN && !isCreatingSchool) {
            if (schoolId) {
                const school = await this.registrationRepository.findSchoolById(schoolId);
                if (!school) {
                    throw new Error("Selected school does not exist");
                }
                if (school.status !== SchoolStatus.VALIDATED) {
                    throw new Error("Only validated partner schools can have administrators");
                }
            }
            // If no schoolId and not creating — they MUST create or select
            if (!schoolId && !newSchoolData) {
                throw new Error("Please select an existing school or register yours");
            }
        }

        // 4. Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData: any = {
            name,
            password: hashedPassword,
            role,
            isActive: true,
            schools: schoolId ? [schoolId] : []
        };
        if (email) userData.email = email.toLowerCase();
        if (phone) userData.phone = phone.trim();

        const user = await this.registrationRepository.createUser(userData);

        // 5. Handle School Creation (TEACHER or SCHOOL_ADMIN creating new school)
        let finalSchoolId = schoolId;
        let createdSchool: any = null;

        if (isCreatingSchool && newSchoolData) {
            // Build address string from available text fields
            // NOTE: city and country in the School schema are ObjectId refs — do NOT pass raw strings
            const addressParts = [newSchoolData.address, newSchoolData.city, newSchoolData.country]
                .filter(Boolean)
                .join(', ');

            createdSchool = await School.create({
                name: newSchoolData.name,
                type: newSchoolData.type || "OTHER",
                address: addressParts || undefined,
                // city and country are ObjectId refs — skip during self-registration (PENDING school, completed by admin later)
                status: SchoolStatus.PENDING,
                isActive: true,
                owner: user._id,
                teachers: role === UserRole.TEACHER ? [user._id] : [],
                admins: [user._id],
                applicants: []
            });

            finalSchoolId = createdSchool._id.toString();

            if (!user.schools) user.schools = [];
            user.schools.push(createdSchool._id);
        }

        // 6. Handle Student auto-declared school — NOUVELLE API (declaredSchoolData)
        if (role === UserRole.STUDENT && !schoolId && declaredSchoolData?.name?.trim() && !skipSchool) {
            const unverifiedSchool = await UnverifiedSchoolService.findOrCreate(
                declaredSchoolData as DeclaredSchoolData,
                user._id as mongoose.Types.ObjectId
            );

            user.unverifiedSchool = unverifiedSchool._id;
            // Marquer le profil comme en attente (sera mis à jour après save du profile)
        }

        // 6b. Handle Student auto-declared school — ANCIENNE API (declaredSchoolName, rétro-compat)
        else if (role === UserRole.STUDENT && !schoolId && declaredSchoolName?.trim() && !skipSchool) {
            createdSchool = await School.create({
                name: declaredSchoolName.trim(),
                type: "OTHER",
                status: SchoolStatus.PENDING,
                isActive: true,
                owner: user._id,
                teachers: [],
                admins: [],
                applicants: []
            });

            finalSchoolId = createdSchool._id.toString();
            if (!user.schools) user.schools = [];
            user.schools.push(createdSchool._id);
        }

        // 7. Handle Role Specific Logic
        if (role === UserRole.STUDENT) {
            const awaitingSchoolValidation = !!user.unverifiedSchool;

            const profile = await this.registrationRepository.createLearnerProfile({
                user: user._id,
                currentLevel: levelId,
                currentField: fieldId,
                awaitingSchoolValidation,
            });

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
                console.log(`[Registration] Teacher ${user._id} created school ${createdSchool._id} and is now owner`);
            } else if (skipSchool) {
                // Classe Libre mode — teacher works independently
                console.log(`[Registration] Teacher ${user._id} registered in Classe Libre mode (no school)`);
            } else if (finalSchoolId) {
                // Teacher selected existing school — add to applicants
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

            if (isCreatingSchool && createdSchool) {
                // School Admin created their own school (auto-référencement)
                console.log(`[Registration] School Admin ${user._id} self-registered school ${createdSchool._id}`);
            } else if (finalSchoolId) {
                // Add directly to school's admins array
                await this.registrationRepository.updateSchool(finalSchoolId, {
                    $addToSet: { admins: user._id }
                });
            }
        }

        await user.save();

        // Return user with created school info if applicable
        const result: any = user.toObject();
        if (createdSchool) {
            result.createdSchool = createdSchool.toObject();
        }

        // Expose awaitingSchoolValidation for the controller
        result.awaitingSchoolValidation = !!result.unverifiedSchool;

        return result;
    }

    /**
     * Register user without role (for onboarding flow)
     * User will complete role selection during onboarding
     */
    async registerUserWithoutRole(data: { name: string; email?: string; phone?: string; password: string }) {
        const { name, email, phone, password } = data;

        // 1. Validate at least one identifier
        if (!email && !phone) {
            throw new Error("Email ou numéro de téléphone requis");
        }

        // 2. Check if user exists
        const existingUser = await this.registrationRepository.findUserByIdentifier({ email, phone });
        if (existingUser) {
            throw new Error("User already exists");
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create user without role - will be set during onboarding
        const userData: any = {
            name,
            password: hashedPassword,
        };
        if (email) userData.email = email.toLowerCase();
        if (phone) userData.phone = phone.trim();

        const user = await this.registrationRepository.createUser(userData);

        return user;
    }
}
