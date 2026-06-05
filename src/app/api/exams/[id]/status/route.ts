import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import Syllabus from "@/models/Syllabus"
import Class from "@/models/Class"
import { NotificationDeliveryService } from "@/lib/services/NotificationDeliveryService"
import { ExamStatus, UserRole } from "@/models/enums"
import { EventPublisher } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"
import mongoose from "mongoose"

/**
 * PATCH /api/exams/[id]/status
 * Update exam status (workflow management)
 * When publishing, notify all students in classes linked to the syllabus
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params
        const { status } = await req.json()

        if (!status || !Object.values(ExamStatus).includes(status)) {
            return NextResponse.json(
                { success: false, message: "Invalid status" },
                { status: 400 }
            )
        }

        await connectDB()

        const exam = await Exam.findById(id)
            .populate('subject', 'name')
            .populate('targetLevels', 'name')

        if (!exam) {
            return NextResponse.json(
                { success: false, message: "Exam not found" },
                { status: 404 }
            )
        }

        // Check ownership
        if (exam.createdById.toString() !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized to modify this exam" },
                { status: 403 }
            )
        }

        const previousStatus = exam.status
        exam.status = status

        // Handle specific status transitions
        if (status === ExamStatus.PUBLISHED) {
            exam.isPublished = true
            exam.publishedAt = new Date()

            // Notify students in classes linked to the syllabus
            await notifyStudentsAboutExam(exam, session.user.id)
        }

        if (status === ExamStatus.VALIDATED) {
            exam.validatedBy = new mongoose.Types.ObjectId(session.user.id)
            exam.validatedAt = new Date()
        }

        await exam.save()

        // Publish event
        const publisher = EventPublisher.getInstance()
        await publisher.publish({
            type: EventType.EXAM_STATUS_CHANGED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(session.user.id),
            data: {
                examId: exam._id,
                previousStatus,
                newStatus: status,
                title: exam.title
            }
        })

        return NextResponse.json({
            success: true,
            data: exam,
            message: `Exam status updated to ${status}`
        })

    } catch (error: any) {
        console.error("[Exam Status API] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * Notify all students in classes linked to the exam's syllabus
 */
async function notifyStudentsAboutExam(exam: any, teacherId: string) {
    try {
        // Find classes linked to this syllabus
        let classIds: string[] = []

        if (exam.syllabus) {
            const syllabus = await Syllabus.findById(exam.syllabus)
            if (syllabus?.classes) {
                classIds = syllabus.classes.map((c: any) => c.toString())
            }
        }

        // If no syllabus, find classes by targetLevels
        if (classIds.length === 0 && exam.targetLevels?.length > 0) {
            const targetLevelIds = exam.targetLevels.map((l: any) =>
                typeof l === 'object' ? l._id : l
            )
            const classes = await Class.find({
                level: { $in: targetLevelIds }
            })
            classIds = classes.map(c => c._id.toString())
        }

        if (classIds.length === 0) {
            console.log("[Notify] No classes found for exam notification")
            return
        }

        // Get all students from these classes
        const classes = await Class.find({ _id: { $in: classIds } })
            .populate('students', '_id name')

        const studentIds = new Set<string>()
        classes.forEach(cls => {
            cls.students?.forEach((student: any) => {
                studentIds.add(student._id.toString())
            })
        })

        console.log(`[Notify] Sending notifications to ${studentIds.size} students for exam: ${exam.title}`)

        // Create notifications for all students
        const notifications = Array.from(studentIds).map(studentId => ({
            userId: new mongoose.Types.ObjectId(studentId),
            type: 'exam',
            title: '📝 Nouvel Examen Disponible',
            message: `L'examen "${exam.title}" est maintenant disponible. Bonne chance !`,
            data: {
                examId: exam._id,
                examTitle: exam.title,
                subject: exam.subject?.name,
                duration: exam.duration,
                startTime: exam.startTime,
                endTime: exam.endTime
            },
            read: false,
        }))

        if (notifications.length > 0) {
            await NotificationDeliveryService.createManyAndPush(notifications)
        }

        // Also notify the teacher
        await NotificationDeliveryService.createAndPush({
            userId: new mongoose.Types.ObjectId(teacherId),
            type: 'success',
            title: '✅ Examen Publié',
            message: `Votre examen "${exam.title}" a été publié avec succès. ${studentIds.size} apprenants ont été notifiés.`,
            data: {
                examId: exam._id,
                examTitle: exam.title,
                studentsNotified: studentIds.size
            },
            read: false,
        })

        console.log(`[Notify] Successfully created ${notifications.length + 1} notifications`)

    } catch (error) {
        console.error("[Notify] Error notifying students:", error)
        // Don't throw - notification failure shouldn't block status change
    }
}
