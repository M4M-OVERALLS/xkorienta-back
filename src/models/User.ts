import mongoose, { Schema, Document, Model } from 'mongoose'
import { UserRole, SubSystem } from './enums'

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId
    name: string
    email: string
    password?: string // Optional for OAuth users
    role: UserRole
    subSystem?: SubSystem
    institution?: string
    schools?: mongoose.Types.ObjectId[] // Refs to School
    teachingSyllabuses?: mongoose.Types.ObjectId[] // Refs to Syllabus

    // Profiles
    learnerProfile?: mongoose.Types.ObjectId // Ref: 'LearnerProfile'
    pedagogicalProfile?: mongoose.Types.ObjectId // Ref: 'PedagogicalProfile'

    // OAuth
    googleId?: string
    githubId?: string

    // Security
    emailVerified?: boolean
    isActive: boolean
    lastLogin?: Date
    loginAttempts: number
    lockedUntil?: Date

    // Preferences
    preferences: {
        language: string
        timezone?: string
        notifications: {
            email: boolean
            push: boolean
        }
    }

    // Metadata
    metadata: {
        avatar?: string
        phone?: string
        address?: string
    }

    // Gamification
    gamification?: {
        totalXP: number
        level: number
        currentStreak: number
        longestStreak: number
        lastActivityDate?: Date
    }

    // Password Reset
    resetPasswordToken?: string
    resetPasswordExpires?: Date

    // Legacy fields (kept for compatibility during migration)
    studentCode?: string
    image?: string

    createdAt: Date
    updatedAt: Date
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: false },
        role: { type: String, enum: Object.values(UserRole), required: false }, // Optional during onboarding
        subSystem: { type: String, enum: Object.values(SubSystem) },
        institution: String,
        schools: [{ type: Schema.Types.ObjectId, ref: 'School' }],
        teachingSyllabuses: [{ type: Schema.Types.ObjectId, ref: 'Syllabus' }],

        learnerProfile: { type: Schema.Types.ObjectId, ref: 'LearnerProfile' },
        pedagogicalProfile: { type: Schema.Types.ObjectId, ref: 'PedagogicalProfile' },

        googleId: { type: String, unique: true, sparse: true },
        githubId: { type: String, unique: true, sparse: true },

        emailVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        lastLogin: Date,
        loginAttempts: { type: Number, default: 0 },
        lockedUntil: Date,

        preferences: {
            language: { type: String, default: 'fr' },
            timezone: String,
            notifications: {
                email: { type: Boolean, default: true },
                push: { type: Boolean, default: true }
            }
        },

        metadata: {
            avatar: String,
            phone: String,
            address: String
        },

        // Gamification
        gamification: {
            totalXP: { type: Number, default: 0 },
            level: { type: Number, default: 1 },
            currentStreak: { type: Number, default: 0 },
            longestStreak: { type: Number, default: 0 },
            lastActivityDate: Date
        },

        // Password Reset
        resetPasswordToken: { type: String, select: false },
        resetPasswordExpires: { type: Date, select: false },

        // Legacy
        studentCode: { type: String, unique: true, sparse: true },
        image: String
    },
    { timestamps: true }
)

// Indexes
UserSchema.index({ role: 1, isActive: 1 })
UserSchema.index({ subSystem: 1, institution: 1 })

// Prevent model recompilation in development
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User
