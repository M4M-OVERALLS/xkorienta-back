import { ISyllabus, SyllabusStatus } from "@/models/Syllabus"
import mongoose from "mongoose"

export interface SyllabusStructure {
    chapters: Chapter[]
}

export interface Chapter {
    id: string
    title: string
    description?: string
    topics: Topic[]
    order: number
}

export interface Topic {
    id: string
    title: string
    content?: string
    concepts?: Concept[]
    resources?: Resource[]
    order: number
}

export interface Concept {
    id: string
    title: string
    description?: string
    order: number
}

export interface Resource {
    id: string
    type: 'PDF' | 'VIDEO' | 'LINK' | 'TEXT'
    url?: string
    content?: string
    title: string
}

/**
 * Builder Pattern for creating complex Syllabus structures
 */
export class SyllabusBuilder {
    private syllabus: Partial<ISyllabus>
    private structure: SyllabusStructure

    constructor() {
        this.syllabus = {
            status: SyllabusStatus.DRAFT,
            version: 1,
            learningObjectives: []
        }
        this.structure = {
            chapters: []
        }
    }

    /**
     * Clear the current structure
     */
    resetStructure(): SyllabusBuilder {
        this.structure = { chapters: [] }
        return this
    }

    /**
     * Clear learning objectives
     */
    resetObjectives(): SyllabusBuilder {
        this.syllabus.learningObjectives = []
        return this
    }

    /**
     * Set basic information
     */
    setBasicInfo(title: string, description?: string): SyllabusBuilder {
        this.syllabus.title = title
        this.syllabus.description = description
        return this
    }

    /**
     * Link context (Teacher, Subject, School)
     */
    setContext(teacherId: string, subjectId: string, schoolId?: string): SyllabusBuilder {
        this.syllabus.teacher = new mongoose.Types.ObjectId(teacherId)
        this.syllabus.subject = new mongoose.Types.ObjectId(subjectId)
        if (schoolId) {
            this.syllabus.school = new mongoose.Types.ObjectId(schoolId)
        }
        return this
    }

    /**
     * Assign to classes
     */
    setClasses(classIds: string[]): SyllabusBuilder {
        this.syllabus.classes = classIds.map(id => new mongoose.Types.ObjectId(id))
        return this
    }

    /**
     * Add learning objectives
     */
    addObjective(objective: string): SyllabusBuilder {
        if (!this.syllabus.learningObjectives) {
            this.syllabus.learningObjectives = []
        }
        this.syllabus.learningObjectives.push(objective)
        return this
    }

    /**
     * Add a chapter to the structure
     */
    addChapter(title: string, description?: string): string {
        const id = crypto.randomUUID()
        const order = this.structure.chapters.length
        this.structure.chapters.push({
            id,
            title,
            description,
            topics: [],
            order
        })
        return id
    }

    /**
     * Add a topic to a specific chapter
     */
    addTopic(chapterId: string, title: string, content?: string): string {
        const chapter = this.structure.chapters.find(c => c.id === chapterId)
        if (!chapter) throw new Error(`Chapter with ID ${chapterId} not found`)

        const id = crypto.randomUUID()
        const order = chapter.topics.length
        chapter.topics.push({
            id,
            title,
            content,
            resources: [],
            order
        })
        return id
    }

    /**
     * Add a concept to a topic
     */
    addConcept(chapterId: string, topicId: string, concept: Omit<Concept, 'id' | 'order'>): SyllabusBuilder {
        const chapter = this.structure.chapters.find(c => c.id === chapterId)
        if (!chapter) throw new Error(`Chapter with ID ${chapterId} not found`)

        const topic = chapter.topics.find(t => t.id === topicId)
        if (!topic) throw new Error(`Topic with ID ${topicId} not found`)

        topic.concepts = topic.concepts || []
        const order = topic.concepts.length
        topic.concepts.push({
            id: crypto.randomUUID(),
            order,
            ...concept
        })
        return this
    }

    /**
     * Add a resource to a topic
     */
    addResource(chapterId: string, topicId: string, resource: Omit<Resource, 'id'>): SyllabusBuilder {
        const chapter = this.structure.chapters.find(c => c.id === chapterId)
        if (!chapter) throw new Error(`Chapter with ID ${chapterId} not found`)

        const topic = chapter.topics.find(t => t.id === topicId)
        if (!topic) throw new Error(`Topic with ID ${topicId} not found`)

        topic.resources = topic.resources || []
        topic.resources.push({
            id: crypto.randomUUID(),
            ...resource
        })
        return this
    }

    /**
     * Build the final Syllabus object
     */
    build(): Partial<ISyllabus> {
        return {
            ...this.syllabus,
            structure: this.structure
        }
    }

    /**
     * Load an existing syllabus into the builder for modification
     */
    static fromExisting(syllabus: ISyllabus): SyllabusBuilder {
        const builder = new SyllabusBuilder()
        builder.syllabus = {
            title: syllabus.title,
            description: syllabus.description,
            teacher: syllabus.teacher,
            subject: syllabus.subject,
            school: syllabus.school,
            status: syllabus.status,
            version: syllabus.version,
            learningObjectives: [...syllabus.learningObjectives]
        }
        builder.structure = JSON.parse(JSON.stringify(syllabus.structure)) // Deep copy
        return builder
    }
}
