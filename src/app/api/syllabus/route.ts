import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Syllabus, { ISyllabus, SyllabusStatus } from "@/models/Syllabus"
import User from "@/models/User"
import { UserRole } from "@/models/enums"
import mongoose from "mongoose"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const subject = searchParams.get('subject') // This might be null if not passed
        const search = searchParams.get('search')

        console.log('[API] Get Syllabuses - Params:', { subject, search, userId: session.user.id })

        const query: any = {
            teacher: session.user.id,
            status: { $ne: SyllabusStatus.ARCHIVED }
        }

        if (subject && subject !== 'undefined' && subject !== 'null') {
            // Ensure valid ObjectId or just let Mongoose cast it. 
            // Trimming just in case.
            query.subject = subject.trim()
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' }
        }

        console.log('[API] Syllabus Query:', JSON.stringify(query))

        const syllabuses = await Syllabus.find(query)
            .populate('subject', 'name')
            .populate('school', 'name')
            .sort({ updatedAt: -1 })
            .lean() // Use lean for performance

        console.log(`[API] Found ${syllabuses.length} syllabuses`)

        return NextResponse.json({ success: true, data: syllabuses })

    } catch (error: any) {
        console.error("Get Syllabuses Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

import { SyllabusBuilder } from "@/lib/patterns/SyllabusBuilder"
import { EventPublisher } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"

// ... imports

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id || session.user.role !== UserRole.TEACHER) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { title, description, subject, school, structure, learningObjectives, classes } = body

        if (!title || !subject) {
            return NextResponse.json(
                { success: false, message: "Missing required fields" },
                { status: 400 }
            )
        }

        await connectDB()

        // Use Builder Pattern
        const builder = new SyllabusBuilder()
            .setBasicInfo(title, description)
            .setContext(session.user.id, subject, school)

        if (classes && Array.isArray(classes)) {
            builder.setClasses(classes)
        }

        // Add Learning Objectives
        if (Array.isArray(learningObjectives)) {
            learningObjectives.forEach((obj: string) => builder.addObjective(obj))
        }

        // Reconstruct structure using builder to ensure validity and ID generation
        // This is "safer" than blindly trusting the JSON structure from client
        if (structure && Array.isArray(structure.chapters)) {
            structure.chapters.forEach((chap: any) => {
                const chapterId = builder.addChapter(chap.title, chap.description)

                if (Array.isArray(chap.topics)) {
                    chap.topics.forEach((top: any) => {
                        const topicId = builder.addTopic(chapterId, top.title, top.content)

                        if (Array.isArray(top.concepts)) {
                            top.concepts.forEach((concept: any) => {
                                builder.addConcept(chapterId, topicId, {
                                    title: concept.title,
                                    description: concept.description
                                })
                            })
                        }

                        if (Array.isArray(top.resources)) {
                            top.resources.forEach((res: any) => {
                                builder.addResource(chapterId, topicId, {
                                    title: res.title,
                                    type: res.type,
                                    url: res.url,
                                    content: res.content
                                })
                            })
                        }
                    })
                }
            })
        }

        const syllabusData = builder.build()
        const newSyllabus = await Syllabus.create(syllabusData)

        // Add to User's teachingSyllabuses
        await User.findByIdAndUpdate(session.user.id, {
            $addToSet: { teachingSyllabuses: newSyllabus._id }
        })

        // Initialize Event System (Ensure observers are registered)
        const { initEventSystem } = await import("@/lib/events")
        initEventSystem()

        // Publish Event
        const publisher = EventPublisher.getInstance()
        await publisher.publish({
            type: EventType.SYLLABUS_CREATED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(session.user.id),
            data: {
                syllabusId: newSyllabus._id,
                teacherId: session.user.id,
                title: newSyllabus.title
            }
        })

        return NextResponse.json({ success: true, data: newSyllabus }, { status: 201 })

    } catch (error: any) {
        console.error("Create Syllabus Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
