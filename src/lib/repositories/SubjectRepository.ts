import Subject, { ISubject } from "@/models/Subject";
import connectDB from "@/lib/mongodb";

export class SubjectRepository {
    /**
     * Find subject by ID with populated relations
     */
    async findById(id: string): Promise<ISubject | null> {
        await connectDB();
        return Subject.findById(id)
            .populate('applicableLevels', 'name code')
            .populate('applicableFields', 'name code')
            .populate('parentSubject', 'name code')
            .populate('childSubjects', 'name code')
            .lean();
    }

    /**
     * Find subjects with filters
     */
    async find(filters: {
        level?: string | string[];
        field?: string;
        subjectType?: string;
        isActive?: boolean;
    } = {}) {
        await connectDB();
        const query: Record<string, unknown> = {};

        if (filters.level) {
            if (Array.isArray(filters.level)) {
                query.applicableLevels = { $in: filters.level };
            } else {
                query.applicableLevels = filters.level;
            }
        }

        if (filters.field) {
            query.applicableFields = filters.field;
        }

        if (filters.subjectType) {
            query.subjectType = filters.subjectType;
        }

        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }

        return Subject.find(query)
            .populate('applicableLevels', 'name code')
            .populate('applicableFields', 'name code')
            .populate('parentSubject', 'name code')
            .lean();
    }

    /**
     * Update subject by ID
     */
    async update(id: string, updateData: Partial<ISubject>): Promise<ISubject | null> {
        await connectDB();
        return Subject.findByIdAndUpdate(id, updateData, { new: true });
    }

    /**
     * Soft delete subject (set isActive to false)
     */
    async softDelete(id: string): Promise<ISubject | null> {
        await connectDB();
        return Subject.findByIdAndUpdate(id, { isActive: false }, { new: true });
    }
}
