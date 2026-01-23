import Request, { IRequest, RequestStatus, RequestType } from "@/models/Request";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class RequestRepository {
    /**
     * Find requests by query
     */
    async find(query: any) {
        await connectDB();
        return Request.find(query)
            .populate('studentId', 'name image email studentCode')
            .populate('teacherId', 'name image')
            .populate('subject', 'name')
            .sort({ priority: -1, createdAt: -1 })
            .lean();
    }

    /**
     * Find request by ID
     */
    async findById(id: string) {
        await connectDB();
        return Request.findById(id)
            .populate('studentId', 'name image email studentCode')
            .populate('teacherId', 'name image')
            .populate('subject', 'name')
            .populate('relatedExam', 'title')
            .lean();
    }

    /**
     * Find request by ID for update (returns mongoose document)
     */
    async findByIdForUpdate(id: string) {
        await connectDB();
        return Request.findById(id)
            .populate('studentId', 'name')
            .populate('teacherId', 'name');
    }

    /**
     * Create a new request
     */
    async create(data: Partial<IRequest>) {
        await connectDB();
        const newRequest = await Request.create(data);
        await newRequest.populate('studentId', 'name image email studentCode');
        await newRequest.populate('teacherId', 'name image');
        return newRequest;
    }

    /**
     * Save request (for updates)
     */
    async save(request: IRequest) {
        if (request instanceof mongoose.Model || request instanceof mongoose.Document) {
            return request.save();
        }
        return request;
    }
}
