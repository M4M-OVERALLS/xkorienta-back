import mongoose, { Schema, Document, Model } from 'mongoose'

export enum AssistanceRequestStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    RESOLVED = 'RESOLVED',
    CLOSED = 'CLOSED'
}

export enum AssistanceRequestPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export enum AssistanceRequestType {
    CONCEPT_HELP = 'CONCEPT_HELP',       // Help understanding a concept
    EXAM_PREP = 'EXAM_PREP',             // Exam preparation help
    REMEDIATION = 'REMEDIATION',         // Remediation request
    GENERAL = 'GENERAL',                 // General question
    TECHNICAL = 'TECHNICAL'              // Technical issue
}

export enum TeacherType {
    SCHOOL = 'SCHOOL',       // Teacher from student's school (free)
    EXTERNAL = 'EXTERNAL'    // Teacher from another school (paid)
}

/**
 * Assistance request from student to teacher
 */
export interface IAssistanceRequest extends Document {
    _id: mongoose.Types.ObjectId

    // Requester
    student: mongoose.Types.ObjectId

    // Context
    class?: mongoose.Types.ObjectId
    subject?: mongoose.Types.ObjectId
    concept?: mongoose.Types.ObjectId
    syllabus?: mongoose.Types.ObjectId
    exam?: mongoose.Types.ObjectId

    // Request details
    type: AssistanceRequestType
    title: string
    description: string
    priority: AssistanceRequestPriority
    status: AssistanceRequestStatus

    // Self-evaluation context (what level student thinks they are)
    selfEvaluationLevel?: string // MasteryLevel

    // Assignment
    assignedTo?: mongoose.Types.ObjectId // Teacher
    assignedAt?: Date

    // Teacher type - distinguishes between school teacher (free) and external teacher (paid)
    teacherType?: TeacherType
    
    // Payment info (for external teachers)
    payment?: {
        amount: number           // Amount in currency
        currency: string         // Currency code (e.g., 'EUR', 'XOF')
        status: 'PENDING' | 'PAID' | 'FAILED'
        paidAt?: Date
    }

    // Resolution
    resolution?: {
        notes: string
        resources?: string[] // Links to helpful resources
        followUpNeeded: boolean
        resolvedAt: Date
    }

    // Tracking
    messages: {
        sender: mongoose.Types.ObjectId
        content: string
        sentAt: Date
    }[]

    createdAt: Date
    updatedAt: Date
}

const AssistanceRequestSchema = new Schema<IAssistanceRequest>(
    {
        student: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        class: {
            type: Schema.Types.ObjectId,
            ref: 'Class'
        },
        subject: {
            type: Schema.Types.ObjectId,
            ref: 'Subject'
        },
        concept: {
            type: Schema.Types.ObjectId,
            ref: 'Concept'
        },
        syllabus: {
            type: Schema.Types.ObjectId,
            ref: 'Syllabus'
        },
        exam: {
            type: Schema.Types.ObjectId,
            ref: 'Exam'
        },
        type: {
            type: String,
            enum: Object.values(AssistanceRequestType),
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        description: {
            type: String,
            required: true,
            maxlength: 2000
        },
        priority: {
            type: String,
            enum: Object.values(AssistanceRequestPriority),
            default: AssistanceRequestPriority.MEDIUM
        },
        status: {
            type: String,
            enum: Object.values(AssistanceRequestStatus),
            default: AssistanceRequestStatus.PENDING
        },
        selfEvaluationLevel: {
            type: String
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedAt: Date,
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
        resolution: {
            notes: String,
            resources: [String],
            followUpNeeded: { type: Boolean, default: false },
            resolvedAt: Date
        },
        messages: [{
            sender: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            content: {
                type: String,
                required: true
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

// Indexes for efficient querying
AssistanceRequestSchema.index({ student: 1, status: 1 })
AssistanceRequestSchema.index({ assignedTo: 1, status: 1 })
AssistanceRequestSchema.index({ class: 1, status: 1 })
AssistanceRequestSchema.index({ subject: 1, status: 1 })
AssistanceRequestSchema.index({ priority: 1, status: 1, createdAt: -1 })

const AssistanceRequest: Model<IAssistanceRequest> = mongoose.models.AssistanceRequest || mongoose.model<IAssistanceRequest>('AssistanceRequest', AssistanceRequestSchema)

export default AssistanceRequest
