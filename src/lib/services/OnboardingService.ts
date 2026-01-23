import { Cycle, SubSystem, SubscriptionStatus, UserRole } from "@/models/enums";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { EducationLevelRepository } from "@/lib/repositories/EducationLevelRepository";
import { LearnerProfileRepository } from "@/lib/repositories/LearnerProfileRepository";
import { PedagogicalProfileRepository } from "@/lib/repositories/PedagogicalProfileRepository";
import { IUser } from "@/models/User";

export class OnboardingService {
    private userRepository: UserRepository;
    private educationLevelRepository: EducationLevelRepository;
    private learnerProfileRepository: LearnerProfileRepository;
    private pedagogicalProfileRepository: PedagogicalProfileRepository;

    constructor() {
        this.userRepository = new UserRepository();
        this.educationLevelRepository = new EducationLevelRepository();
        this.learnerProfileRepository = new LearnerProfileRepository();
        this.pedagogicalProfileRepository = new PedagogicalProfileRepository();
    }

    /**
     * Complete user onboarding process
     */
    async completeOnboarding(email: string, role: string, details: any): Promise<IUser> {
        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error("User not found");
        }

        // Prevent changing role if already set (security measure),
        // but do not block if the same role is already set and onboarding is incomplete.
        if (user.role && user.role !== role) {
            throw new Error("Role already assigned");
        }

        // Update User Role
        user.role = role as UserRole;

        // Generate student code if role is STUDENT
        if (role === "STUDENT") {
            user.studentCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            // Resolve (or create) an EducationLevel so LearnerProfile.currentLevel is never missing.
            const subSystem: SubSystem =
                details?.subSystem && Object.values(SubSystem).includes(details.subSystem)
                    ? details.subSystem
                    : SubSystem.FRANCOPHONE;

            const cycle: Cycle =
                details?.cycle && Object.values(Cycle).includes(details.cycle)
                    ? details.cycle
                    : Cycle.COLLEGE;

            const levelName: string =
                typeof details?.level === "string" && details.level.trim().length > 0
                    ? details.level.trim()
                    : "NIVEAU_INCONNU";

            let educationLevel = await this.educationLevelRepository.findBySubSystemCycleAndName(
                subSystem,
                cycle,
                levelName
            );

            if (!educationLevel) {
                const last = await this.educationLevelRepository.findLastBySubSystemAndCycle(
                    subSystem,
                    cycle
                );
                const order = (last?.order ?? 0) + 1;
                const code = `ONB_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

                educationLevel = await this.educationLevelRepository.create({
                    name: levelName,
                    code,
                    cycle,
                    subSystem,
                    order,
                    isActive: true,
                    metadata: {
                        displayName: { fr: levelName, en: levelName },
                        description: "Créé automatiquement lors de l'onboarding."
                    }
                });
            }

            // Create/update LearnerProfile
            await this.learnerProfileRepository.findOneAndUpdateUpsert(
                user._id.toString(),
                {
                    user: user._id,
                    subscriptionStatus: SubscriptionStatus.FREEMIUM,
                    stats: {
                        totalExamsTaken: 0,
                        averageScore: 0,
                        totalStudyTime: 0
                    },
                    gamification: {
                        level: 1,
                        xp: 0,
                        badges: [],
                        streak: 0
                    }
                },
                {
                    currentLevel: educationLevel._id
                }
            );
        } else if (role === "TEACHER") {
            // Create PedagogicalProfile if not exists
            const existingProfile = await this.pedagogicalProfileRepository.findByUserIdBasic(
                user._id.toString()
            );

            if (!existingProfile) {
                await this.pedagogicalProfileRepository.create({
                    user: user._id,
                    contributionTypes: [],
                    accessScope: 'SUBJECT',
                    scopeDetails: {
                        specificSubjects: [],
                        specificLevels: [],
                        specificFields: []
                    },
                    stats: {
                        totalExamsCreated: 0,
                        totalExamsValidated: 0,
                        totalStudentsSupervised: 0,
                        averageStudentScore: 0
                    }
                });
            }
        }

        await this.userRepository.save(user);
        return user;
    }
}
