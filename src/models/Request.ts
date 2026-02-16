import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Request Model
 * 
 * Represents assistance requests between students and teachers:
 * - Tutoring requests
 * - Supplementary evaluation requests
 * - General assistance requests
 */

export enum RequestType {
    TUTORING = 'TUTORING',           // Demande de tutorat
    EVALUATION = 'EVALUATION',       // Évaluation supplémentaire
    ASSISTANCE = 'ASSISTANCE',       // Aide générale
    REMEDIATION = 'REMEDIATION'      // Remédiation ciblée
}

export enum RequestStatus {
    PENDING = 'PENDING',           // Initial state
    AVAILABLE = 'AVAILABLE',       // External request waiting for a teacher to claim
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    SCHEDULED = 'SCHEDULED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum RequestPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export enum TeacherType {
    SCHOOL = 'SCHOOL',       // Teacher from student's school (free)
    EXTERNAL = 'EXTERNAL'    // Teacher from another school (paid)
}

export interface IRequest extends Document {
    _id: mongoose.Types.ObjectId

    // Participants
    studentId: mongoose.Types.ObjectId
    teacherId?: mongoose.Types.ObjectId  // Optional for external requests (claimed later)

    // Teacher type
    teacherType?: TeacherType

    // Payment info (for external teachers)
    payment?: {
        amount: number
        currency: string
        status: 'PENDING' | 'PAID' | 'FAILED'
        paidAt?: Date
    }

    // Request details
    type: RequestType
    subject?: mongoose.Types.ObjectId
    title: string
    message: string
    priority: RequestPriority

    // Response
    status: RequestStatus
    responseMessage?: string
    respondedAt?: Date

    // Scheduling (for tutoring/evaluation)
    scheduledAt?: Date
    scheduledDuration?: number // minutes
    meetingLink?: string

    // Related content
    relatedExam?: mongoose.Types.ObjectId
    relatedAttempt?: mongoose.Types.ObjectId
    relatedConcepts?: mongoose.Types.ObjectId[]

    // Completion
    completedAt?: Date
    feedback?: {
        rating: number // 1-5
        comment?: string
    }

    // In-ticket conversation
    messages: {
        _id?: mongoose.Types.ObjectId
        sender: mongoose.Types.ObjectId
        senderName?: string
        senderRole?: 'student' | 'teacher'
        content: string
        sentAt: Date
    }[]

    createdAt: Date
    updatedAt: Date
}

const RequestSchema = new Schema<IRequest>(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        teacherId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false  // Optional for external requests
        },
        teacherType: {
            type: String,
            enum: Object.values(TeacherType),
            default: TeacherType.SCHOOL
        },
        payment: {
            amount: { type: Number, default: 0 },
            currency: { type: String, default: 'XOF' },
            status: {
                type: String,
                enum: ['PENDING', 'PAID', 'FAILED'],
                default: 'PENDING'
            },
            paidAt: Date
        },
        type: {
            type: String,
            enum: Object.values(RequestType),
            required: true
        },
        subject: {
            type: Schema.Types.ObjectId,
            ref: 'Subject'
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        message: {
            type: String,
            required: true,
            maxlength: 2000
        },
        priority: {
            type: String,
            enum: Object.values(RequestPriority),
            default: RequestPriority.MEDIUM
        },
        status: {
            type: String,
            enum: Object.values(RequestStatus),
            default: RequestStatus.PENDING
        },
        responseMessage: {
            type: String,
            maxlength: 1000
        },
        respondedAt: {
            type: Date
        },
        scheduledAt: {
            type: Date
        },
        scheduledDuration: {
            type: Number,
            min: 15,
            max: 180
        },
        meetingLink: {
            type: String
        },
        relatedExam: {
            type: Schema.Types.ObjectId,
            ref: 'Exam'
        },
        relatedAttempt: {
            type: Schema.Types.ObjectId,
            ref: 'Attempt'
        },
        relatedConcepts: [{
            type: Schema.Types.ObjectId,
            ref: 'Concept'
        }],
        completedAt: {
            type: Date
        },
        feedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comment: {
                type: String,
                maxlength: 500
            }
        },
        messages: [{
            sender: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            senderName: {
                type: String
            },
            senderRole: {
                type: String,
                enum: ['student', 'teacher']
            },
            content: {
                type: String,
                required: true,
                maxlength: 5000
            },
            sentAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    {
        timestamps: true
    }
)

// Indexes
RequestSchema.index({ studentId: 1, status: 1 })
RequestSchema.index({ teacherId: 1, status: 1 })
RequestSchema.index({ type: 1, status: 1 })
RequestSchema.index({ createdAt: -1 })
RequestSchema.index({ priority: -1, createdAt: -1 })

// Clear cached model in dev to ensure schema changes are picked up
if (process.env.NODE_ENV === 'development' && mongoose.models.Request) {
    delete mongoose.models.Request;
}

const Request: Model<IRequest> = mongoose.models.Request || mongoose.model<IRequest>('Request', RequestSchema)

export default Request
