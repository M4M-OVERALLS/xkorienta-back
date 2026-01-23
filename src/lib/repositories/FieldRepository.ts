import Field, { IField } from "@/models/Field";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class FieldRepository {
    /**
     * Find fields with filters
     */
    async find(filters: {
        level?: string | string[];
        cycle?: string;
        category?: string;
        isActive?: boolean;
        parentField?: string;
    } = {}): Promise<IField[]> {
        await connectDB();
        const query: any = {};

        if (filters.level) {
            if (Array.isArray(filters.level)) {
                query.applicableLevels = { $in: filters.level.map(l => new mongoose.Types.ObjectId(l)) };
            } else {
                query.applicableLevels = new mongoose.Types.ObjectId(filters.level);
            }
        }
        if (filters.cycle) query.cycle = filters.cycle;
        if (filters.category) query.category = filters.category;
        if (filters.isActive !== undefined) query.isActive = filters.isActive;
        if (filters.parentField) query.parentField = new mongoose.Types.ObjectId(filters.parentField);

        return Field.find(query)
            .populate('applicableLevels', 'name code')
            .populate('parentField', 'name code')
            .lean();
    }

    /**
     * Find field by ID with populated relations
     */
    async findById(id: string): Promise<IField | null> {
        await connectDB();
        return Field.findById(id)
            .populate('applicableLevels', 'name code cycle')
            .populate('parentField', 'name code')
            .populate('childFields', 'name code')
            .lean();
    }

    /**
     * Create field
     */
    async create(data: Partial<IField>): Promise<IField> {
        await connectDB();
        return Field.create(data);
    }

    /**
     * Update field by ID
     */
    async updateById(id: string, data: Partial<IField>): Promise<IField | null> {
        await connectDB();
        return Field.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('applicableLevels', 'name code')
            .populate('parentField', 'name code')
            .lean();
    }

    /**
     * Soft delete field (set isActive to false)
     */
    async softDelete(id: string): Promise<IField | null> {
        await connectDB();
        return Field.findByIdAndUpdate(
            id,
            { $set: { isActive: false } },
            { new: true }
        )
            .populate('applicableLevels', 'name code')
            .populate('parentField', 'name code')
            .lean();
    }
}
