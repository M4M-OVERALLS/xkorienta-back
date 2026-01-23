import { ForumRepository } from "@/lib/repositories/ForumRepository";
import { ForumPostRepository } from "@/lib/repositories/ForumPostRepository";
import { PostStatus } from "@/models/ForumPost";
import { UserRole } from "@/models/enums";
import { safeTrigger, getForumChannel } from "@/lib/pusher";
import mongoose from "mongoose";

export class ForumPostService {
    private forumRepository: ForumRepository;
    private forumPostRepository: ForumPostRepository;

    constructor() {
        this.forumRepository = new ForumRepository();
        this.forumPostRepository = new ForumPostRepository();
    }

    /**
     * Get posts for a forum with pagination
     */
    async getPosts(forumId: string, page: number = 1, limit: number = 20) {
        // Verify forum exists
        const forum = await this.forumRepository.findByIdLean(forumId);
        if (!forum) {
            throw new Error("Forum non trouvé");
        }

        const { posts, total } = await this.forumPostRepository.findByForumId(forumId, {
            page,
            limit
        });

        return {
            posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Create a new post in forum
     */
    async createPost(
        forumId: string,
        userId: string,
        userRole: UserRole,
        data: {
            title?: string;
            content: string;
            isAnnouncement?: boolean;
        }
    ) {
        // Verify forum exists
        const forum = await this.forumRepository.findById(forumId);
        if (!forum) {
            throw new Error("Forum non trouvé");
        }

        // Check posting permissions
        const isCreator = forum.createdBy.toString() === userId;
        const isMember = forum.members.some(m => m.toString() === userId);
        const isStudent = userRole === UserRole.STUDENT;

        if (!isCreator && !isMember) {
            throw new Error("Vous n'êtes pas membre de ce forum");
        }

        if (isStudent && !forum.allowStudentPosts) {
            throw new Error("Les étudiants ne peuvent pas publier dans ce forum");
        }

        // Create post
        const post = await this.forumPostRepository.create({
            forumId: new mongoose.Types.ObjectId(forumId),
            authorId: new mongoose.Types.ObjectId(userId),
            title: data.title,
            content: data.content,
            isAnnouncement: data.isAnnouncement && !isStudent, // Only teachers can make announcements
            status: forum.requireApproval && isStudent ? PostStatus.PENDING : PostStatus.PUBLISHED
        });

        // Update forum stats
        forum.postCount += 1;
        forum.lastPostAt = new Date();
        forum.lastPostBy = new mongoose.Types.ObjectId(userId);
        await this.forumRepository.save(forum);

        // Populate for response
        await this.forumPostRepository.populateAuthor(post);

        // Trigger Pusher for real-time
        safeTrigger(getForumChannel(forumId), 'new-post', {
            post: post.toObject()
        });

        return post;
    }

    /**
     * Add a reply to a post
     */
    async addReply(
        forumId: string,
        postId: string,
        userId: string,
        content: string,
        userInfo: {
            name?: string | null;
            image?: string | null;
            role?: string | null;
        }
    ) {
        const post = await this.forumPostRepository.findById(postId);
        if (!post) {
            throw new Error("Post non trouvé");
        }

        const newReply = {
            _id: new mongoose.Types.ObjectId(),
            authorId: new mongoose.Types.ObjectId(userId),
            content,
            createdAt: new Date(),
            likes: []
        };

        post.replies.push(newReply as any);
        post.replyCount = post.replies.length; // Manually update count
        await this.forumPostRepository.save(post);

        // Trigger Pusher event (safely handles network errors)
        // Include full author info for UI
        const replyWithUser = {
            ...newReply,
            authorId: {
                _id: userId,
                name: userInfo.name,
                image: userInfo.image,
                role: userInfo.role
            }
        };

        safeTrigger(getForumChannel(forumId), 'new-reply', {
            postId,
            reply: replyWithUser
        });

        return newReply;
    }
}
