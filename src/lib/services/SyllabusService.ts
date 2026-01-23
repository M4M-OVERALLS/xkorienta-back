import { SyllabusRepository } from "@/lib/repositories/SyllabusRepository";
import { SyllabusBuilder, SyllabusStructure } from "@/lib/patterns/SyllabusBuilder";
import { SyllabusStatus } from "@/models/Syllabus";
import mongoose from "mongoose";
import User from "@/models/User";

interface SyllabusQuery {
    teacher?: string;
    subject?: string;
    school?: string;
}

export class SyllabusService {

    /**
     * List syllabuses with filtering
     */
    static async listSyllabuses(filters: {
        teacherId?: string;
        subject?: string;
        school?: string;
    }) {
        const query: SyllabusQuery = {};

        if (filters.teacherId) {
            query.teacher = filters.teacherId;
        }

        if (filters.subject) {
            query.subject = filters.subject;
        }

        if (filters.school) {
            query.school = filters.school;
        }

        return await SyllabusRepository.find(query);
    }

    /**
     * Create a new syllabus using the Builder pattern
     */
    static async createSyllabus(data: {
        title: string;
        description?: string;
        subject: string;
        school?: string;
        learningObjectives?: string[];
        structure?: SyllabusStructure;
    }, teacherId: string) {
        // Validate required fields
        if (!data.title || !data.subject) {
            throw new Error("Title and Subject are required");
        }

        // Use Builder to construct the syllabus
        const builder = new SyllabusBuilder();
        builder.setBasicInfo(data.title, data.description);
        builder.setContext(teacherId, data.subject, data.school);

        if (data.learningObjectives && Array.isArray(data.learningObjectives)) {
            data.learningObjectives.forEach((obj: string) => builder.addObjective(obj));
        }

        const syllabusData = builder.build();
        if (data.structure) {
            syllabusData.structure = data.structure;
        }

        const syllabus = await SyllabusRepository.create(syllabusData);

        // Add syllabus to user's profile
        await User.findByIdAndUpdate(teacherId, {
            $addToSet: { teachingSyllabuses: syllabus._id }
        });

        return syllabus;
    }

    /**
     * Clone a syllabus for a teacher
     */
    static async cloneSyllabus(syllabusId: string, teacherId: string) {
        if (!mongoose.Types.ObjectId.isValid(syllabusId)) {
            throw new Error("Invalid syllabus ID");
        }

        // Get original syllabus
        const originalSyllabus = await SyllabusRepository.findByIdLean(syllabusId);
        if (!originalSyllabus) {
            throw new Error("Original syllabus not found");
        }

        // Deep copy logic - exclude MongoDB internal fields
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, createdAt, updatedAt, __v, ...syllabusData } = originalSyllabus as unknown as Record<string, unknown>;

        const originalTitle = (syllabusData.title as string) || 'Syllabus';
        const newTitle = `Copie de ${originalTitle}`;

        // Create new syllabus with cloned data
        const newSyllabus = await SyllabusRepository.create({
            ...syllabusData,
            title: newTitle,
            teacher: teacherId, // Current user becomes the owner
            status: SyllabusStatus.DRAFT, // Reset status to draft
            version: 1,
            classes: [], // Do not copy class assignments
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Add to User's teachingSyllabuses
        await User.findByIdAndUpdate(teacherId, {
            $addToSet: { teachingSyllabuses: newSyllabus._id }
        });

        // Initialize Event System (Ensure observers are registered)
        const { initEventSystem } = await import("@/lib/events");
        initEventSystem();

        // Publish Event
        const { EventPublisher } = await import("@/lib/events/EventPublisher");
        const { EventType } = await import("@/lib/events/types");
        const publisher = EventPublisher.getInstance();
        await publisher.publish({
            type: EventType.SYLLABUS_CREATED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(teacherId),
            data: {
                syllabusId: newSyllabus._id,
                teacherId: teacherId,
                title: newSyllabus.title
            }
        });

        return newSyllabus;
    }

    static async getSyllabusById(id: string) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid syllabus ID");
        }

        const syllabus = await SyllabusRepository.findById(id);
        if (!syllabus) {
            throw new Error("Syllabus not found");
        }
        return syllabus;
    }

    static async updateSyllabus(id: string, userId: string, updatePayload: {
        title?: string;
        description?: string;
        structure?: SyllabusStructure;
        learningObjectives?: string[];
        status?: SyllabusStatus;
    }) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid syllabus ID");
        }

        const existingSyllabus = await SyllabusRepository.findById(id);
        if (!existingSyllabus) {
            throw new Error("Syllabus not found");
        }

        if (existingSyllabus.teacher.toString() !== userId) {
            throw new Error("Forbidden"); // Or specific usage error
        }

        const { title, description, structure, learningObjectives, status } = updatePayload;

        // Use Builder Pattern
        const builder = SyllabusBuilder.fromExisting(existingSyllabus)
            .setBasicInfo(title || existingSyllabus.title, description || existingSyllabus.description);

        // Rebuild Structure
        if (structure && Array.isArray(structure.chapters)) {
            builder.resetStructure();
            structure.chapters.forEach((chap) => {
                const chapterId = builder.addChapter(chap.title, chap.description);
                if (Array.isArray(chap.topics)) {
                    chap.topics.forEach((top) => {
                        const topicId = builder.addTopic(chapterId, top.title, top.content);

                        // Handle resources
                        if (Array.isArray(top.resources)) {
                            top.resources.forEach((res) => {
                                builder.addResource(chapterId, topicId, {
                                    title: res.title,
                                    type: res.type,
                                    url: res.url,
                                    content: res.content
                                });
                            });
                        }
                    });
                }
            });
        }

        // Rebuild Objectives
        if (learningObjectives && Array.isArray(learningObjectives)) {
            builder.resetObjectives();
            learningObjectives.forEach((obj: string) => builder.addObjective(obj));
        }

        const updateData = builder.build();

        // Preserve concepts by bypassing builder limitations if necessary
        // (Logic imported from original route)
        if (structure) {
            (updateData as { structure?: SyllabusStructure }).structure = structure;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { version, ...updateDataWithoutVersion } = updateData;

        const finalUpdate = {
            $set: {
                ...updateDataWithoutVersion,
                status: status || existingSyllabus.status,
            },
            $inc: { version: 1 }
        };

        const updatedSyllabus = await SyllabusRepository.update(id, finalUpdate);

        // Event Publishing
        // Dynamic imports to avoid circular dependencies if any, and keep it clean
        const { initEventSystem } = await import("@/lib/events");
        initEventSystem();

        const { EventPublisher } = await import("@/lib/events/EventPublisher");
        const { EventType } = await import("@/lib/events/types");

        const publisher = EventPublisher.getInstance();
        await publisher.publish({
            type: EventType.SYLLABUS_UPDATED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(userId),
            data: {
                syllabusId: updatedSyllabus?._id,
                teacherId: userId,
                title: updatedSyllabus?.title,
                version: updatedSyllabus?.version
            }
        });

        return updatedSyllabus;
    }

    static async deleteSyllabus(id: string, userId: string) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid syllabus ID");
        }

        const existingSyllabus = await SyllabusRepository.findById(id);
        if (!existingSyllabus) {
            throw new Error("Syllabus not found");
        }

        if (existingSyllabus.teacher.toString() !== userId) {
            throw new Error("Forbidden");
        }

        // Soft delete (Archive)
        // Ideally repository should handle this logic or just update
        // Using direct save/update here via repository update method would be cleaner
        // But the original code used .save(). Let's use Repository.update

        await SyllabusRepository.update(id, { status: SyllabusStatus.ARCHIVED });

        return true;
    }
}
