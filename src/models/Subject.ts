import mongoose, { Schema, Document, Model } from 'mongoose'
import { SubjectType, SubSystem } from './enums'

export interface ISubject extends Document {
    name: string
    code: string
    subSystem: SubSystem
    applicableLevels: mongoose.Types.ObjectId[]
    applicableFields: mongoose.Types.ObjectId[]
    parentSubject?: mongoose.Types.ObjectId
    isTransversal: boolean
    subjectType: SubjectType
    isActive: boolean
    metadata: {
        displayName: {
            fr: string
            en: string
        }
        description?: string
        icon?: string
        color?: string
        coefficient?: number
    }
    _cachedExamCount: number
    _cachedLearningUnitCount: number
    createdAt: Date
    updatedAt: Date
}

const SubjectSchema = new Schema<ISubject>(
    {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true },
        subSystem: { type: String, enum: Object.values(SubSystem), required: true },
        applicableLevels: [{ type: Schema.Types.ObjectId, ref: 'EducationLevel' }],
        applicableFields: [{ type: Schema.Types.ObjectId, ref: 'Field' }],
        parentSubject: { type: Schema.Types.ObjectId, ref: 'Subject' },
        isTransversal: { type: Boolean, default: false },
        subjectType: { type: String, enum: Object.values(SubjectType), required: true },
        isActive: { type: Boolean, default: true },
        metadata: {
            displayName: {
                fr: { type: String, required: true },
                en: { type: String, required: true }
            },
            description: String,
            icon: String,
            color: String,
            coefficient: Number
        },
        _cachedExamCount: { type: Number, default: 0 },
        _cachedLearningUnitCount: { type: Number, default: 0 }
    },
    { timestamps: true }
)

// Indexes
// Note: code index with unique:true is already created via field definition
SubjectSchema.index({ subSystem: 1, subjectType: 1 })
SubjectSchema.index({ applicableLevels: 1 })
SubjectSchema.index({ applicableFields: 1 })
SubjectSchema.index({ isTransversal: 1, isActive: 1 })

const Subject: Model<ISubject> = mongoose.models.Subject || mongoose.model<ISubject>('Subject', SubjectSchema)

export default Subject
