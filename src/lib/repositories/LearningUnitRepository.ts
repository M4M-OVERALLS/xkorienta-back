import LearningUnit, { ILearningUnit } from "@/models/LearningUnit";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class LearningUnitRepository {
    /**
     * Find learning units with filters
     */
    async find(filters: {
        subject?: string;
        parentUnit?: string | null;
        unitType?: string;
        isActive?: boolean;
    }): Promise<ILearningUnit[]> {
        await connectDB();
        const query: any = {};

        if (filters.subject) {
            query.subject = new mongoose.Types.ObjectId(filters.subject);
        }
        if (filters.parentUnit !== undefined) {
            if (filters.parentUnit === null) {
                query.parentUnit = { $exists: false };
            } else {
                query.parentUnit = new mongoose.Types.ObjectId(filters.parentUnit);
            }
        }
        if (filters.unitType) {
            query.type = filters.unitType;
        }
        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }

        return LearningUnit.find(query)
            .populate('subject', 'name code')
            .populate('parentUnit', 'name code')
            .lean();
    }

    /**
     * Find learning unit by ID with populated relations
     */
    async findById(id: string): Promise<ILearningUnit | null> {
        await connectDB();
        return LearningUnit.findById(id)
            .populate('subject', 'name code')
            .populate('parentUnit', 'name code')
            .populate('childUnits', 'name code')
            .lean();
    }

    /**
     * Create learning unit
     */
    async create(data: Partial<ILearningUnit>): Promise<ILearningUnit> {
        await connectDB();
        return LearningUnit.create(data);
    }

    /**
     * Update learning unit by ID
     */
    async updateById(id: string, data: Partial<ILearningUnit>): Promise<ILearningUnit | null> {
        await connectDB();
        return LearningUnit.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('subject', 'name code')
            .populate('parentUnit', 'name code')
            .lean();
    }

    /**
     * Soft delete learning unit (set isActive to false)
     */
    async softDelete(id: string): Promise<ILearningUnit | null> {
        await connectDB();
        return LearningUnit.findByIdAndUpdate(
            id,
            { $set: { isActive: false } },
            { new: true }
        )
            .populate('subject', 'name code')
            .populate('parentUnit', 'name code')
            .lean();
    }
}
