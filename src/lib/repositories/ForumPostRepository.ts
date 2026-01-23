import ForumPost, { IForumPost, PostStatus } from "@/models/ForumPost";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ForumPostRepository {
    /**
     * Find posts by forumId with pagination
     */
    async findByForumId(
        forumId: string,
        options: {
            page?: number;
            limit?: number;
            skip?: number;
        } = {}
    ): Promise<{ posts: IForumPost[]; total: number }> {
        await connectDB();
        const { page = 1, limit = 20, skip = (page - 1) * limit } = options;

        const posts = await ForumPost.find({
            forumId: new mongoose.Types.ObjectId(forumId),
            status: PostStatus.PUBLISHED
        })
            .populate('authorId', 'name image role')
            .populate('replies.authorId', 'name image role')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await ForumPost.countDocuments({
            forumId: new mongoose.Types.ObjectId(forumId),
            status: PostStatus.PUBLISHED
        });

        return { posts, total };
    }

    /**
     * Find post by ID
     */
    async findById(postId: string): Promise<IForumPost | null> {
        await connectDB();
        return ForumPost.findById(postId);
    }

    /**
     * Create forum post
     */
    async create(data: Partial<IForumPost>): Promise<IForumPost> {
        await connectDB();
        return ForumPost.create(data);
    }

    /**
     * Save forum post document (for updates)
     */
    async save(post: IForumPost): Promise<IForumPost> {
        if (post instanceof mongoose.Model || post instanceof mongoose.Document) {
            return post.save();
        }
        throw new Error("Invalid forum post document for save operation.");
    }

    /**
     * Populate post author
     */
    async populateAuthor(post: IForumPost): Promise<IForumPost> {
        if (post instanceof mongoose.Model || post instanceof mongoose.Document) {
            return post.populate('authorId', 'name image role');
        }
        throw new Error("Invalid forum post document for populate operation.");
    }
}
