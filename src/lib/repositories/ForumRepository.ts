import Forum, { IForum } from "@/models/Forum";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ForumRepository {
    /**
     * Find forum by ID
     */
    async findById(forumId: string): Promise<IForum | null> {
        await connectDB();
        return Forum.findById(forumId);
    }

    /**
     * Find forum by ID (lean)
     */
    async findByIdLean(forumId: string): Promise<IForum | null> {
        await connectDB();
        return Forum.findById(forumId).lean();
    }

    /**
     * Find forum by ID with populated relations
     */
    async findByIdWithPopulate(forumId: string): Promise<IForum | null> {
        await connectDB();
        return Forum.findById(forumId)
            .populate('createdBy', 'name image')
            .populate('relatedClass', 'name')
            .populate('relatedSubject', 'name')
            .populate('members', 'name image')
            .lean();
    }

    /**
     * Find forums with query
     */
    async find(query: any): Promise<IForum[]> {
        await connectDB();
        return Forum.find(query)
            .populate('createdBy', 'name image')
            .populate('relatedClass', 'name')
            .populate('relatedSubject', 'name')
            .populate('lastPostBy', 'name')
            .sort({ lastPostAt: -1, createdAt: -1 })
            .lean();
    }

    /**
     * Create forum
     */
    async create(data: Partial<IForum>): Promise<IForum> {
        await connectDB();
        return Forum.create(data);
    }

    /**
     * Save forum document (for updates)
     */
    async save(forum: IForum): Promise<IForum> {
        if (forum instanceof mongoose.Model || forum instanceof mongoose.Document) {
            return forum.save();
        }
        throw new Error("Invalid forum document for save operation.");
    }

    /**
     * Populate forum relations
     */
    async populateRelations(forum: IForum, fields: string[]): Promise<IForum> {
        if (forum instanceof mongoose.Model || forum instanceof mongoose.Document) {
            return forum.populate(fields.join(' '));
        }
        throw new Error("Invalid forum document for populate operation.");
    }
}
