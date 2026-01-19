import { AssistanceRepository } from "@/lib/repositories/AssistanceRepository";
import Class from "@/models/Class";
import mongoose from "mongoose";
import { IAssistanceRequest } from "@/models/AssistanceRequest";

export class AssistanceService {
    static async createRequest(data: any, studentId: string) {
        const studentClass = await Class.findOne({
            students: new mongoose.Types.ObjectId(studentId),
            isActive: true
        }).lean();

        const requestData: Partial<IAssistanceRequest> = {
            student: new mongoose.Types.ObjectId(studentId),
            class: studentClass?._id,
            subject: data.subjectId ? new mongoose.Types.ObjectId(data.subjectId) : undefined,
            concept: data.conceptId ? new mongoose.Types.ObjectId(data.conceptId) : undefined,
            syllabus: data.syllabusId ? new mongoose.Types.ObjectId(data.syllabusId) : undefined,
            type: data.type,
            title: data.title,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            status: 'PENDING' as any // Use literal or enum if available, casting to avoid import cycle if enum is in model
        };

        const repo = new AssistanceRepository();
        return await repo.create(requestData);
    }

    static async getStudentRequests(studentId: string) {
        const repo = new AssistanceRepository();
        return await repo.findByStudent(studentId);
    }
}
