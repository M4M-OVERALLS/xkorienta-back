import mongoose, { Schema, Document, Model } from 'mongoose'
import { ClassValidationStatus, ClassTeacherRole, ClassTeacherPermission } from './enums'

/**
 * Represents a teacher's association with a class
 * Each teacher can teach a specific subject in the class with defined permissions
 */
export interface IClassTeacher {
    teacher: mongoose.Types.ObjectId      // Ref: 'User'
    subject: mongoose.Types.ObjectId      // Ref: 'Subject' - The subject they teach
    role: ClassTeacherRole                // OWNER, COLLABORATOR, or ASSISTANT
    permissions: ClassTeacherPermission[] // Specific permissions granted
    addedBy: mongoose.Types.ObjectId      // Who invited this teacher
    addedAt: Date                         // When they were added
    isActive: boolean                     // Can be deactivated without removal
}

export interface IClass extends Document {
    _id: mongoose.Types.ObjectId
    name: string // Ex: "Tle C 2"
    school?: mongoose.Types.ObjectId // Ref: 'School' - optional for independent classes
    mainTeacher: mongoose.Types.ObjectId // Ref: 'User' (Legacy, kept for compatibility)

    level: mongoose.Types.ObjectId // Ref: 'EducationLevel'
    field?: mongoose.Types.ObjectId // Ref: 'Field'
    specialty?: mongoose.Types.ObjectId // Ref: 'Field' (Sous-spécialité)

    /**
     * Multi-teacher collaboration system
     * Allows multiple teachers to collaborate on the same class,
     * each for their specific subject with configurable permissions
     */
    teachers: IClassTeacher[]

    students: mongoose.Types.ObjectId[] // Ref: 'User'
    academicYear: string // Ex: "2024-2025"

    // Validation by School Admin
    validationStatus: ClassValidationStatus
    validatedBy?: mongoose.Types.ObjectId // Ref: 'User' (School Admin)
    validatedAt?: Date
    rejectionReason?: string

    // For classes created before school affiliation is approved
    isIndependent?: boolean
    pendingSchoolId?: mongoose.Types.ObjectId // Target school when waiting for approval

    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Subdocument schema for class teachers
 */
const ClassTeacherSchema = new Schema<IClassTeacher>(
    {
        teacher: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        subject: {
            type: Schema.Types.ObjectId,
            ref: 'Subject',
            required: true
        },
        role: {
            type: String,
            enum: Object.values(ClassTeacherRole),
            required: true
        },
        permissions: [{
            type: String,
            enum: Object.values(ClassTeacherPermission)
        }],
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { _id: true }
)

const ClassSchema = new Schema<IClass>(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        school: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: false // Allow classes without school (pending approval)
        },
        mainTeacher: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        level: {
            type: Schema.Types.ObjectId,
            ref: 'EducationLevel',
            required: true
        },
        field: {
            type: Schema.Types.ObjectId,
            ref: 'Field'
        },
        specialty: {
            type: Schema.Types.ObjectId,
            ref: 'Field'
        },
        // Multi-teacher collaboration
        teachers: {
            type: [ClassTeacherSchema],
            default: []
        },
        students: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        academicYear: {
            type: String,
            required: true
        },
        // Validation by School Admin
        validationStatus: {
            type: String,
            enum: Object.values(ClassValidationStatus),
            default: ClassValidationStatus.PENDING // New classes start as pending
        },
        
        // For classes created before school affiliation is approved
        isIndependent: {
            type: Boolean,
            default: false
        },
        
        // Target school ID (for classes waiting to be grafted)
        pendingSchoolId: {
            type: Schema.Types.ObjectId,
            ref: 'School'
        },
        validatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        validatedAt: Date,
        rejectionReason: String,
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
ClassSchema.index({ school: 1, academicYear: 1 })
ClassSchema.index({ mainTeacher: 1 })
ClassSchema.index({ students: 1 })
ClassSchema.index({ school: 1, validationStatus: 1 })
ClassSchema.index({ 'teachers.teacher': 1 }) // Index for finding classes by collaborating teacher
ClassSchema.index({ 'teachers.subject': 1 }) // Index for finding by subject

const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema)

export default Class

