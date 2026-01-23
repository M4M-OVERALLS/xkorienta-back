import { ForumRepository } from "@/lib/repositories/ForumRepository";
import { ClassRepository } from "@/lib/repositories/ClassRepository";
import { ForumType, ForumStatus, IForum } from "@/models/Forum";
import { UserRole } from "@/models/enums";
import { safeTrigger } from "@/lib/pusher";
import mongoose from "mongoose";

export class ForumService {
    private forumRepository: ForumRepository;
    private classRepository: ClassRepository;

    constructor() {
        this.forumRepository = new ForumRepository();
        this.classRepository = new ClassRepository();
    }

    /**
     * Get forums for a user based on role and filters
     */
    async getForums(
        userId: string,
        role: UserRole,
        filters: {
            classId?: string;
            type?: string;
        } = {}
    ) {
        // Build query based on role
        let query: any = { status: ForumStatus.ACTIVE };

        if (role === UserRole.TEACHER) {
            // Teachers see forums they created or are members of
            query.$or = [
                { createdBy: new mongoose.Types.ObjectId(userId) },
                { members: new mongoose.Types.ObjectId(userId) }
            ];
        } else if (role === UserRole.STUDENT) {
            // Students see forums they are members of
            query.members = new mongoose.Types.ObjectId(userId);
        }

        if (filters.classId) {
            query.relatedClass = new mongoose.Types.ObjectId(filters.classId);
        }
        if (filters.type) {
            query.type = filters.type;
        }

        return await this.forumRepository.find(query);
    }

    /**
     * Get forum by ID with access control
     */
    async getForumById(forumId: string, userId: string) {
        const forum = await this.forumRepository.findByIdWithPopulate(forumId);
        if (!forum) {
            throw new Error("Forum non trouvé");
        }

        // Check if user is a member
        const isMember = (forum as any).members.some(
            (m: any) => m._id.toString() === userId
        ) || (forum as any).createdBy._id.toString() === userId;

        if (!isMember && (forum as any).isPrivate) {
            throw new Error("Accès non autorisé");
        }

        return forum;
    }

    /**
     * Create a new forum
     */
    async createForum(
        userId: string,
        role: UserRole,
        data: {
            name: string;
            description?: string;
            type?: ForumType;
            classId?: string;
            subjectId?: string;
            isPrivate?: boolean;
            allowStudentPosts?: boolean;
        }
    ) {
        // Check permissions
        if (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN && role !== UserRole.PRINCIPAL) {
            throw new Error("Seuls les enseignants peuvent créer des forums");
        }

        if (!data.name) {
            throw new Error("Le nom est requis");
        }

        // Build members list
        let memberIds: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(userId)];

        // If linked to a class, add all students
        if (data.classId) {
            const classData = await this.classRepository.findById(data.classId);
            if (classData && (classData as any).students) {
                const studentIds = (classData as any).students.map((s: any) =>
                    new mongoose.Types.ObjectId(s.toString())
                );
                memberIds = [...memberIds, ...studentIds];
            }
        }

        // Deduplicate members
        const uniqueMembers = [...new Set(memberIds.map(id => id.toString()))].map(
            id => new mongoose.Types.ObjectId(id)
        );

        const forum = await this.forumRepository.create({
            name: data.name,
            description: data.description,
            type: data.type || ForumType.CLASS,
            relatedClass: data.classId ? new mongoose.Types.ObjectId(data.classId) : undefined,
            relatedSubject: data.subjectId ? new mongoose.Types.ObjectId(data.subjectId) : undefined,
            createdBy: new mongoose.Types.ObjectId(userId),
            members: uniqueMembers,
            isPrivate: data.isPrivate || false,
            allowStudentPosts: data.allowStudentPosts !== false
        });

        // Populate for response
        await this.forumRepository.populateRelations(forum, ['createdBy', 'relatedClass']);

        // Trigger Pusher event for real-time updates
        if (data.classId) {
            safeTrigger(`class-${data.classId}`, 'forum-created', {
                forum: forum.toObject()
            });
        }

        return forum;
    }

    /**
     * Update forum settings
     */
    async updateForum(
        forumId: string,
        userId: string,
        data: {
            name?: string;
            description?: string;
            isPrivate?: boolean;
            allowStudentPosts?: boolean;
            status?: ForumStatus;
        }
    ) {
        const forum = await this.forumRepository.findById(forumId);
        if (!forum) {
            throw new Error("Forum non trouvé");
        }

        // Only creator can update
        if (forum.createdBy.toString() !== userId) {
            throw new Error("Non autorisé");
        }

        if (data.name) forum.name = data.name;
        if (data.description !== undefined) forum.description = data.description;
        if (data.isPrivate !== undefined) forum.isPrivate = data.isPrivate;
        if (data.allowStudentPosts !== undefined) forum.allowStudentPosts = data.allowStudentPosts;
        if (data.status) forum.status = data.status;

        await this.forumRepository.save(forum);

        return forum;
    }

    /**
     * Archive (soft delete) a forum
     */
    async archiveForum(forumId: string, userId: string) {
        const forum = await this.forumRepository.findById(forumId);
        if (!forum) {
            throw new Error("Forum non trouvé");
        }

        // Only creator can delete
        if (forum.createdBy.toString() !== userId) {
            throw new Error("Non autorisé");
        }

        forum.status = ForumStatus.ARCHIVED;
        await this.forumRepository.save(forum);

        return forum;
    }
}
