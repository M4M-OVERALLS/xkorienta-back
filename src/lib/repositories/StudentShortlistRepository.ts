import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentShortlist from "@/models/StudentShortlist";

export class StudentShortlistRepository {
    async findByStudentId(studentId: string) {
        await connectDB();
        return StudentShortlist.findOne({
            student: new mongoose.Types.ObjectId(studentId)
        }).lean();
    }

    async ensureByStudentId(studentId: string) {
        await connectDB();
        return StudentShortlist.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(studentId) },
            {
                $setOnInsert: {
                    student: new mongoose.Types.ObjectId(studentId),
                    schools: [],
                    specialties: []
                }
            },
            { upsert: true, new: true }
        ).lean();
    }

    async addSchool(studentId: string, schoolId: string) {
        await connectDB();
        return StudentShortlist.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(studentId) },
            {
                $setOnInsert: { student: new mongoose.Types.ObjectId(studentId) },
                $addToSet: { schools: new mongoose.Types.ObjectId(schoolId) }
            },
            { upsert: true, new: true }
        ).lean();
    }

    async removeSchool(studentId: string, schoolId: string) {
        await connectDB();
        return StudentShortlist.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(studentId) },
            {
                $setOnInsert: { student: new mongoose.Types.ObjectId(studentId) },
                $pull: { schools: new mongoose.Types.ObjectId(schoolId) }
            },
            { upsert: true, new: true }
        ).lean();
    }

    async addSpecialty(studentId: string, specialtyId: string) {
        await connectDB();
        return StudentShortlist.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(studentId) },
            {
                $setOnInsert: { student: new mongoose.Types.ObjectId(studentId) },
                $addToSet: { specialties: new mongoose.Types.ObjectId(specialtyId) }
            },
            { upsert: true, new: true }
        ).lean();
    }

    async removeSpecialty(studentId: string, specialtyId: string) {
        await connectDB();
        return StudentShortlist.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(studentId) },
            {
                $setOnInsert: { student: new mongoose.Types.ObjectId(studentId) },
                $pull: { specialties: new mongoose.Types.ObjectId(specialtyId) }
            },
            { upsert: true, new: true }
        ).lean();
    }
}
