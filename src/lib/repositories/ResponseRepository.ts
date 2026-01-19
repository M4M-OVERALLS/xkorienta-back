import Response, { IResponse } from "@/models/Response";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ResponseRepository {
    async findByAttemptAndQuestion(attemptId: string, questionId: string): Promise<IResponse | null> {
        await connectDB();
        return Response.findOne({
            attemptId,
            questionId
        });
    }

    async update(id: string, data: Partial<IResponse>): Promise<IResponse | null> {
        await connectDB();
        return Response.findByIdAndUpdate(id, data, { new: true });
    }

    async create(data: Partial<IResponse>): Promise<IResponse> {
        await connectDB();
        return Response.create(data);
    }
}
