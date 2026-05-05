import Syllabus, { ISyllabus } from "@/models/Syllabus";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";

export class SyllabusRepository {
    static async findById(id: string): Promise<ISyllabus | null> {
        await connectDB();
        return await Syllabus.findById(id)
            .populate('subject', 'name code subSystem applicableLevels')
            .populate('school', 'name')
            .populate('teacher', 'name email')
            .populate({
                path: 'classes',
                select: 'name level',
                populate: { path: 'level', select: 'name code' },
            });
    }

    /** Retourne l'ObjectId brut du subject, même si le document référencé n'existe plus. */
    static async findSubjectIdRaw(syllabusId: string): Promise<string | null> {
        await connectDB();
        const lean = await Syllabus.findById(syllabusId).select('subject').lean();
        return lean?.subject ? lean.subject.toString() : null;
    }

    static async findByIdLean(id: string): Promise<ISyllabus | null> {
        await connectDB();
        return await Syllabus.findById(id).lean();
    }

    static async find(query: any): Promise<ISyllabus[]> {
        await connectDB();
        return await Syllabus.find(query)
            .populate('subject', 'name code')
            .populate('school', 'name')
            .sort({ updatedAt: -1 })
            .lean();
    }

    static async create(data: any): Promise<ISyllabus> {
        await connectDB();
        return await Syllabus.create(data);
    }

    static async update(id: string, updateData: any): Promise<ISyllabus | null> {
        await connectDB();
        return await Syllabus.findByIdAndUpdate(id, updateData, { new: true });
    }

    static async save(syllabus: any): Promise<ISyllabus> {
        // Handle save for existing instance if passed as document, or generic handling not ideal here.
        // Usually .save() is on the document instance.
        // For repo pattern without ORM instance passing, we usually use update or create.
        if (syllabus instanceof Syllabus) {
            return await syllabus.save();
        }
        throw new Error("Invalid syllabus document");
    }

    static async delete(id: string): Promise<ISyllabus | null> {
        await connectDB();
        return await Syllabus.findByIdAndDelete(id);
    }
}
