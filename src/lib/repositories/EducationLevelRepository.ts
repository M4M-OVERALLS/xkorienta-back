import EducationLevel, { IEducationLevel } from "@/models/EducationLevel";
import connectDB from "@/lib/mongodb";
import { Cycle, SubSystem } from "@/models/enums";

export class EducationLevelRepository {
    /**
     * Find education level by criteria
     */
    async findOne(query: any): Promise<IEducationLevel | null> {
        await connectDB();
        return EducationLevel.findOne(query);
    }

    /**
     * Find education level by subSystem, cycle, and name/code
     */
    async findBySubSystemCycleAndName(
        subSystem: SubSystem,
        cycle: Cycle,
        levelName: string
    ): Promise<IEducationLevel | null> {
        await connectDB();
        return EducationLevel.findOne({
            subSystem,
            cycle,
            $or: [
                { name: levelName },
                { code: levelName },
                { "metadata.displayName.fr": levelName }
            ]
        });
    }

    /**
     * Find last education level by subSystem and cycle (sorted by order)
     */
    async findLastBySubSystemAndCycle(
        subSystem: SubSystem,
        cycle: Cycle
    ): Promise<IEducationLevel | null> {
        await connectDB();
        return EducationLevel.findOne({ subSystem, cycle })
            .sort({ order: -1 })
            .lean();
    }

    /**
     * Create education level
     */
    async create(data: Partial<IEducationLevel>): Promise<IEducationLevel> {
        await connectDB();
        return EducationLevel.create(data);
    }
}
