import Attempt, { IAttempt, AttemptStatus } from "@/models/Attempt";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class AttemptRepository {
    async findById(id: string): Promise<IAttempt | null> {
        await connectDB();
        return Attempt.findById(id).populate('examId', 'title description duration config').lean(); // Careful with lean if saving later, but for reads ok. 
        // Actually, Service uses save() on document, so better return mongoose document for update operations
    }

    async findByIdForUpdate(id: string): Promise<IAttempt | null> {
        await connectDB();
        return Attempt.findById(id);
    }

    async save(attempt: IAttempt): Promise<IAttempt> {
        // In Mongoose, you call save() on the document instance. 
        // Only if we passed a plain object we might need model.create or update.
        // But here we likely get a document from findByIdForUpdate.
        if (attempt instanceof mongoose.Model || attempt instanceof mongoose.Document) {
            return attempt.save();
        }
        // Fallback or if lean was used (should be avoided for updates generally unless using findOneAndUpdate)
        return attempt;
    }
}
