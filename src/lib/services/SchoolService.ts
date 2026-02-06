import School, { ISchool } from "@/models/School";
import User, { IUser } from "@/models/User";
import Class from "@/models/Class";
import Attempt from "@/models/Attempt";
import Exam from "@/models/Exam";
import { SchoolRepository } from "@/lib/repositories/SchoolRepository";
import { TeacherRepository } from "@/lib/repositories/TeacherRepository";
import { ClassRepository } from "@/lib/repositories/ClassRepository";
import { AttemptRepository } from "@/lib/repositories/AttemptRepository";
import { ExamRepository } from "@/lib/repositories/ExamRepository";
import mongoose from "mongoose";

export type StudentSchoolFilters = {
    query?: string;
    country?: string;
    city?: string;
    level?: string;
    type?: string;
    specialty?: string;
    accreditation?: string;
    modality?: string;
    language?: string;
    costMin?: number;
    costMax?: number;
    scoreMin?: number;
};

export class SchoolService {

    /**
     * Get School Stats
     * Returns: Total Students, Total Teachers, Active Classes, Average Score
     */
    static async searchSchools(search?: string, type?: string) {
        const query: any = { isActive: true };

        if (type) {
            query.type = type;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // TODO: Move query logic to SchoolRepository completely
        return School.find(query)
            .populate('admins', 'name email')
            .sort({ name: 1 })
            .lean();
    }

    // service pour la liste des écoles côté apprenant
    static async getStudentSchools(studentId: string, filters?: StudentSchoolFilters) {
        if (!studentId) {
            throw new Error("Unauthorized");
        }

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            throw new Error("Invalid studentId");
        }

        const repo = new SchoolRepository();
        const schools = await repo.findSchoolsForStudents();

        const mapped = schools.map((school) => {
            const schoolData = school as unknown as Record<string, unknown>;
            const city = schoolData.city as Record<string, unknown> | undefined;
            const country = schoolData.country as Record<string, unknown> | undefined;

            const specialtiesRaw = schoolData.specialties;
            const specialtiesArray = Array.isArray(specialtiesRaw) ? specialtiesRaw : (specialtiesRaw ? [specialtiesRaw] : []);
            const specialties = specialtiesArray
                .map((s) => (s as Record<string, unknown>).name as string | undefined)
                .filter(Boolean) as string[];

            const accreditationRaw = schoolData.accreditation;
            const accreditationArray = Array.isArray(accreditationRaw) ? accreditationRaw : (accreditationRaw ? [accreditationRaw] : []);
            const accreditation = accreditationArray
                .map((a) => (a as Record<string, unknown>).name as string | undefined)
                .filter(Boolean) as string[];

            const badges = schoolData.badges as Record<string, unknown> | undefined;
            const certifications = (badges?.certification as Array<Record<string, unknown>> | undefined)
                ?.map((c) => c.name as string | undefined)
                .filter(Boolean) as string[] | undefined;

            const academicLevel = (schoolData.academicLevel as Array<Record<string, unknown>> | undefined)
                ?.map((l) => l.name as string | undefined)
                .filter(Boolean) as string[] | undefined;

            const partnerships = (schoolData.partnerships as Array<Record<string, unknown>> | undefined)
                ?.map((p) => p.name as string | undefined)
                .filter(Boolean) as string[] | undefined;

            const careerPaths = (schoolData.careerPaths as Array<Record<string, unknown>> | undefined)
                ?.map((c) => ({
                    title: c.title as string,
                    salary: c.salary as string,
                    demand: c.demand as 'high' | 'medium' | 'low'
                }));

            return {
                _id: (schoolData._id as { toString: () => string }).toString(),
                name: (schoolData.name as string) || '',
                type: (schoolData.type as string) || '',
                address: schoolData.address as string | undefined,
                city: city?.name as string | undefined,
                country: country?.name as string | undefined,
                logoUrl: schoolData.logoUrl as string | undefined,
                status: schoolData.status as string | undefined,
                contactInfo: schoolData.contactInfo as Record<string, unknown> | undefined,
                specialties: specialties.length > 0 ? specialties : undefined,
                accreditation: accreditation.length > 0 ? accreditation : undefined,
                tuitionFee: schoolData.tuitionFee as { min: number; max: number; currency: string } | undefined,
                modality: schoolData.modality as string | undefined,
                languages: schoolData.Languages as string[] | undefined,
                xkorientaScore: schoolData.xkorientaScore as number | undefined,
                badges: {
                    employment: badges?.employment as boolean | undefined,
                    alternance: badges?.alternance as boolean | undefined,
                    certifications: certifications && certifications.length > 0 ? certifications : undefined
                },
                academicLevel: academicLevel && academicLevel.length > 0 ? academicLevel : undefined,
                degrees: schoolData.degrees as string[] | undefined,
                partnerships: partnerships && partnerships.length > 0 ? partnerships : undefined,
                studentCount: schoolData.studentCount as number | undefined,
                foundedYear: schoolData.foundedYear as number | undefined,
                description: schoolData.description as string | undefined,
                learningOutcomes: schoolData.learningOutcomes as string[] | undefined,
                careerPaths
            };
        });

        if (!filters) {
            return mapped;
        }

        const normalize = (value: string | undefined) => (value || '').trim().toLowerCase();
        const query = normalize(filters.query);
        const countryFilter = normalize(filters.country);
        const cityFilter = normalize(filters.city);
        const levelFilter = normalize(filters.level);
        const typeFilter = normalize(filters.type);
        const specialtyFilter = normalize(filters.specialty);
        const accreditationFilter = normalize(filters.accreditation);
        const modalityFilter = normalize(filters.modality);
        const languageFilter = normalize(filters.language);
        const costMin = typeof filters.costMin === 'number' ? filters.costMin : undefined;
        const costMax = typeof filters.costMax === 'number' ? filters.costMax : undefined;
        const scoreMin = typeof filters.scoreMin === 'number' ? filters.scoreMin : undefined;

        return mapped.filter((school) => {
            if (query && !normalize(school.name).includes(query)) {
                return false;
            }
            if (countryFilter && normalize(school.country).includes(countryFilter) === false) {
                return false;
            }
            if (cityFilter && normalize(school.city).includes(cityFilter) === false) {
                return false;
            }
            if (typeFilter && normalize(school.type).includes(typeFilter) === false) {
                return false;
            }
            if (modalityFilter && normalize(school.modality).includes(modalityFilter) === false) {
                return false;
            }
            if (languageFilter) {
                const languages = (school.languages || []).map((l) => normalize(l));
                if (!languages.includes(languageFilter)) {
                    return false;
                }
            }
            if (levelFilter) {
                const levels = (school.academicLevel || []).map((l) => normalize(l));
                if (!levels.includes(levelFilter)) {
                    return false;
                }
            }
            if (specialtyFilter) {
                const specialties = (school.specialties || []).map((s) => normalize(s));
                if (!specialties.includes(specialtyFilter)) {
                    return false;
                }
            }
            if (accreditationFilter) {
                const acc = (school.accreditation || []).map((a) => normalize(a));
                if (!acc.includes(accreditationFilter)) {
                    return false;
                }
            }
            if (costMin !== undefined || costMax !== undefined) {
                const tuition = school.tuitionFee;
                if (!tuition) {
                    return false;
                }
                if (costMin !== undefined && tuition.max < costMin) {
                    return false;
                }
                if (costMax !== undefined && tuition.min > costMax) {
                    return false;
                }
            }
            if (scoreMin !== undefined) {
                const score = school.xkorientaScore;
                if (typeof score !== 'number' || score < scoreMin) {
                    return false;
                }
            }
            return true;
        });
    }
    
    static async getSchoolStats(schoolId: string) {
        const schoolRepo = new SchoolRepository();
        const teacherRepo = new TeacherRepository();
        const classRepo = new ClassRepository();
        const examRepo = new ExamRepository();
        const attemptRepo = new AttemptRepository();

        // 1. Get school basic info
        const school = await schoolRepo.findByIdBasic(schoolId);
        if (!school) return null;

        // 2. Get teachers count and IDs
        const teacherIds = await teacherRepo.findTeacherIdsBySchool(schoolId);
        const teachersCount = teacherIds.length;

        // 3. Get admins count
        const adminsCount = await schoolRepo.getAdminsCount(schoolId);

        // 4. Get classes with students and level populated
        const classes = await classRepo.findBySchoolWithDetails(schoolId);
        const classesCount = classes.length;

        console.log(`[SchoolStats] Found ${classesCount} classes for school ${schoolId}`); // Debug log

        // 5. Students Count (Unique students across all classes)
        const allStudents = classes.flatMap((c: any) => c.students || []);
        const uniqueStudentsMap = new Map();
        allStudents.forEach((student: any) => {
            if (student && student._id) {
                uniqueStudentsMap.set(student._id.toString(), student);
            }
        });
        const studentsCount = uniqueStudentsMap.size;
        const studentIds = Array.from(uniqueStudentsMap.keys());

        // 6. Count exams created by school teachers
        const examsCount = await examRepo.countExamsByTeachers(teacherIds);

        // 7. Calculate average score & get performance data
        let averageScore = 0;
        let scoreDistribution = [
            { range: '0-20%', count: 0, color: '#ef4444' },
            { range: '21-40%', count: 0, color: '#f97316' },
            { range: '41-60%', count: 0, color: '#eab308' },
            { range: '61-80%', count: 0, color: '#3b82f6' },
            { range: '81-100%', count: 0, color: '#22c55e' },
        ];
        let recentPerformance: any[] = [];

        if (studentIds.length > 0) {
            // Get average score
            averageScore = await attemptRepo.getAverageScoreForUsers(studentIds);

            // Get score distribution
            const distribution = await attemptRepo.getScoreDistributionForUsers(studentIds);

            // Map distribution to our format
            distribution.forEach((bucket: any) => {
                if (bucket._id === 0) scoreDistribution[0].count = bucket.count;
                else if (bucket._id === 20) scoreDistribution[1].count = bucket.count;
                else if (bucket._id === 40) scoreDistribution[2].count = bucket.count;
                else if (bucket._id === 60) scoreDistribution[3].count = bucket.count;
                else if (bucket._id === 80) scoreDistribution[4].count = bucket.count;
            });

            // Get weekly performance trend (last 8 weeks)
            const weeklyPerformance = await attemptRepo.getWeeklyPerformanceForUsers(studentIds, 8);

            // Transform to chart format
            const weekNames = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
            recentPerformance = weeklyPerformance.map((w: any, i: number) => ({
                name: weekNames[i] || `S${i + 1}`,
                score: Math.round(w.avgScore * 10) / 10,
                exams: w.count
            }));

            // If no data, provide sample structure
            if (recentPerformance.length === 0) {
                recentPerformance = weekNames.slice(0, 4).map(name => ({
                    name,
                    score: 0,
                    exams: 0
                }));
            }
        }

        // 8. Get recent activity (last 5 exam results created by these teachers)
        const recentExams = await examRepo.findRecentExamsByTeachers(teacherIds, 5);

        // 9. Calculate class distribution by level
        const classDistribution = classes.reduce((acc: any[], cls: any) => {
            const levelName = cls.level?.name || 'Non défini';
            const existing = acc.find(item => item.name === levelName);
            if (existing) {
                existing.value += 1;
            } else {
                acc.push({ name: levelName, value: 1 });
            }
            return acc;
        }, []);

        // 10. Calculate completion rate
        const totalAttempts = await attemptRepo.countAttemptsForUsers(studentIds);
        const completedAttempts = await attemptRepo.countAttemptsForUsers(studentIds, 'COMPLETED');
        const completionRate = totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0;

        return {
            details: school,
            stats: {
                totalStudents: studentsCount,
                totalTeachers: teachersCount,
                adminsCount,
                activeClasses: classesCount,
                examsCount,
                averageScore: Math.round(averageScore * 10) / 10,
                completionRate
            },
            charts: {
                scoreDistribution,
                recentPerformance,
                classDistribution,
                recentExams: recentExams.map((e: any) => ({
                    id: e._id,
                    title: e.title,
                    subject: e.subject?.name || 'N/A',
                    date: e.startTime,
                    status: e.status
                }))
            }
        };
    }

    /**
     * Get Teachers List
     */
    static async getSchoolTeachers(schoolId: string) {
        const teacherRepo = new TeacherRepository();
        return await teacherRepo.findTeachersBySchool(schoolId);
    }

    /**
     * Add Teacher to School
     */
    static async addTeacherToSchool(schoolId: string, userId: string) {
        return await School.findByIdAndUpdate(
            schoolId,
            { $addToSet: { teachers: userId } },
            { new: true }
        );
    }

    /**
     * Remove Teacher from School
     */
    static async removeTeacherFromSchool(schoolId: string, userId: string) {
        // Also remove school from user?
        await User.findByIdAndUpdate(userId, { $pull: { schools: schoolId } });

        return await School.findByIdAndUpdate(
            schoolId,
            { $pull: { teachers: userId } },
            { new: true }
        );
    }

    /**
     * Get Public Schools (for discovery)
     */
    static async getPublicSchools() {
        return await School.find({
            status: 'APPROVED',
            isActive: true
        })
            .select('name type address logoUrl contactInfo createdAt applicants')
            .sort({ name: 1 })
            .limit(20);
    }

    /**
     * Get Teacher's Schools (Owned or Member)
     */
    static async getTeacherSchools(userId: string) {
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const repo = new SchoolRepository();
        return await repo.findByTeacher(userId);
    }

    /**
     * Get School Classes
     */
    static async getSchoolClasses(schoolId: string) {
        const classRepo = new ClassRepository();
        return await classRepo.findBySchool(schoolId);
    }

    // ==========================================
    // TEACHER APPROVAL METHODS (For School Admins)
    // ==========================================

    /**
     * Get pending teacher applications for a school
     */
    static async getPendingTeachers(schoolId: string) {
        const school = await School.findById(schoolId)
            .populate('applicants', 'name email createdAt metadata.avatar')
            .select('applicants');

        return school?.applicants || [];
    }

    /**
     * Approve a teacher application
     * Also grafts independent classes to the school
     */
    static async approveTeacher(schoolId: string, teacherId: string) {
        // Move from applicants to teachers
        const school = await School.findByIdAndUpdate(
            schoolId,
            {
                $pull: { applicants: teacherId },
                $addToSet: { teachers: teacherId }
            },
            { new: true }
        );

        // Add school to teacher's schools list
        await User.findByIdAndUpdate(teacherId, {
            $addToSet: { schools: schoolId }
        });

        // Graft independent classes to this school
        await this.graftTeacherClassesToSchool(teacherId, schoolId);

        return school;
    }

    /**
     * Graft independent classes to a school when teacher is approved
     */
    static async graftTeacherClassesToSchool(teacherId: string, schoolId: string) {
        const { ClassValidationStatus } = await import("@/models/enums");
        
        // Find all independent classes by this teacher that were waiting for this school
        const classesToGraft = await Class.find({
            mainTeacher: teacherId,
            isIndependent: true,
            $or: [
                { pendingSchoolId: schoolId },
                { school: null }
            ]
        });

        console.log(`[GraftClasses] Found ${classesToGraft.length} independent classes to graft for teacher ${teacherId} to school ${schoolId}`);

        // Update each class to link it to the school
        for (const cls of classesToGraft) {
            await Class.findByIdAndUpdate(cls._id, {
                school: schoolId,
                isIndependent: false,
                pendingSchoolId: null,
                validationStatus: ClassValidationStatus.VALIDATED // Auto-validate since teacher is now approved
            });
            console.log(`[GraftClasses] Grafted class ${cls._id} (${cls.name}) to school ${schoolId}`);
        }

        return classesToGraft.length;
    }

    /**
     * Reject a teacher application
     */
    static async rejectTeacher(schoolId: string, teacherId: string) {
        // Remove from applicants
        const school = await School.findByIdAndUpdate(
            schoolId,
            { $pull: { applicants: teacherId } },
            { new: true }
        );

        // Remove school from teacher's schools list
        await User.findByIdAndUpdate(teacherId, {
            $pull: { schools: schoolId }
        });

        return school;
    }

    static async validateSchool(schoolId: string, adminId: string, status?: any): Promise<ISchool | null> {
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();

        const school = await schoolRepo.updateValidationStatus(schoolId, true, adminId, status);

        if (!school) {
            throw new Error("School not found");
        }

        return school;
    }

    /**
     * Verify if user is admin of the school
     */
    static async verifySchoolAdmin(schoolId: string, userId: string): Promise<boolean> {
        // We import the repository dynamically to avoid circular dependencies if any, 
        // or just import at top if safe. 
        // For now, let's just use the repository pattern as requested.
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();
        return await schoolRepo.isSchoolAdmin(schoolId, userId);
    }

    /**
     * Get schools where user is admin
     */
    static async getAdminSchools(userId: string) {
        const { SchoolRepository } = await import("@/lib/repositories/SchoolRepository");
        const schoolRepo = new SchoolRepository();
        return await schoolRepo.findByAdmin(userId);
    }

    /**
     * Apply to a school
     */
    static async applyToSchool(schoolId: string, userId: string) {
        const repo = new SchoolRepository();

        // 1. Check if school exists
        const school = await repo.findById(schoolId);
        if (!school) {
            throw new Error("School not found");
        }

        // 2. Check if user is already a member
        const isMember = await repo.isUserMember(schoolId, userId);
        if (isMember) {
            throw new Error("You are already a member of this school");
        }

        // 3. Check if user has already applied
        const hasApplied = await repo.isUserApplicant(schoolId, userId);
        if (hasApplied) {
            throw new Error("You have already applied to this school");
        }

        // 4. Add user to applicants
        await repo.addApplicant(schoolId, userId);

        return { success: true, message: "Application submitted successfully" };
    }
}

