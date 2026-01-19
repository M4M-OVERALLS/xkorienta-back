import AssistanceRequest, { IAssistanceRequest, AssistanceRequestStatus } from "@/models/AssistanceRequest";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class AssistanceRepository {
    async create(data: Partial<IAssistanceRequest>) {
        await connectDB();
        return AssistanceRequest.create(data);
    }

    async findByStudent(studentId: string) {
        await connectDB();
        return AssistanceRequest.find({
            student: new mongoose.Types.ObjectId(studentId)
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
    }
}
