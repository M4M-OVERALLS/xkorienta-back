import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IInvitation extends Document {
    token: string
    classId?: mongoose.Types.ObjectId
    schoolId?: mongoose.Types.ObjectId
    role?: string
    email?: string
    type: 'LINK' | 'INDIVIDUAL'
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
    expiresAt?: Date

    // Enhanced fields for link invitations
    maxUses?: number // null = unlimited
    currentUses: number
    registeredStudents: mongoose.Types.ObjectId[]
    description?: string

    createdBy: mongoose.Types.ObjectId
    createdAt: Date
    updatedAt: Date
}

const InvitationSchema = new Schema<IInvitation>(
    {
        token: {
            type: String,
            required: true,
            unique: true
        },
        classId: {
            type: Schema.Types.ObjectId,
            ref: 'Class'
        },
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: 'School'
        },
        role: {
            type: String,
            default: 'STUDENT'
        },
        email: {
            type: String,
        },
        type: {
            type: String,
            enum: ['LINK', 'INDIVIDUAL'],
            required: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
            default: 'PENDING'
        },
        expiresAt: {
            type: Date
        },
        // Enhanced fields
        maxUses: {
            type: Number,
            required: false // undefined = unlimited
        },
        currentUses: {
            type: Number,
            default: 0
        },
        registeredStudents: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        description: {
            type: String
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
InvitationSchema.index({ token: 1 })
InvitationSchema.index({ classId: 1 })
InvitationSchema.index({ email: 1 })
InvitationSchema.index({ status: 1, expiresAt: 1 })

const Invitation: Model<IInvitation> = mongoose.models.Invitation || mongoose.model<IInvitation>('Invitation', InvitationSchema)

export default Invitation
