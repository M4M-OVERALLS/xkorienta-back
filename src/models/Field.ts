import mongoose, { Schema, Document, Model } from 'mongoose'
import { FieldCategory, Cycle, SubSystem } from './enums'

export interface IField extends Document {
    name: string
    code: string
    category: FieldCategory
    cycle: Cycle
    subSystem: SubSystem
    applicableLevels: mongoose.Types.ObjectId[]
    parentField?: mongoose.Types.ObjectId
    childFields: mongoose.Types.ObjectId[]
    isActive: boolean
    metadata: {
        displayName: {
            fr: string
            en: string
        }
        description?: string
        icon?: string
        color?: string
    }
    _cachedSubjectCount: number
    createdAt: Date
    updatedAt: Date
}

const FieldSchema = new Schema<IField>(
    {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true },
        category: { type: String, enum: Object.values(FieldCategory), required: true },
        cycle: { type: String, enum: Object.values(Cycle), required: true },
        subSystem: { type: String, enum: Object.values(SubSystem), required: true },
        applicableLevels: [{ type: Schema.Types.ObjectId, ref: 'EducationLevel' }],
        parentField: { type: Schema.Types.ObjectId, ref: 'Field' },
        childFields: [{ type: Schema.Types.ObjectId, ref: 'Field' }],
        isActive: { type: Boolean, default: true },
        metadata: {
            displayName: {
                fr: { type: String, required: true },
                en: { type: String, required: true }
            },
            description: String,
            icon: String,
            color: String
        },
        _cachedSubjectCount: { type: Number, default: 0 }
    },
    { timestamps: true }
)

// Indexes
// Note: code index with unique:true is already created via field definition
FieldSchema.index({ subSystem: 1, cycle: 1 })
FieldSchema.index({ applicableLevels: 1 })

const Field: Model<IField> = mongoose.models.Field || mongoose.model<IField>('Field', FieldSchema)

export default Field
