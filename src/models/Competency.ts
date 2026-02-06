import mongoose, { Schema, Document, Model } from 'mongoose'
import { CompetencyType } from './enums'

export interface ICompetency extends Document {
    name: string
    code: string
    type: CompetencyType
    description?: string
    relatedSubjects: mongoose.Types.ObjectId[]
    assessmentCriteria: {
        criterion: string
        weight: number
    }[]
    isActive: boolean
    metadata: {
        displayName: {
            fr: string
            en: string
        }
        icon?: string
        category?: string
    }
    createdAt: Date
    updatedAt: Date
}

const CompetencySchema = new Schema<ICompetency>(
    {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true },
        type: { type: String, enum: Object.values(CompetencyType), required: true },
        description: String,
        relatedSubjects: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
        assessmentCriteria: [{
            criterion: String,
            weight: Number
        }],
        isActive: { type: Boolean, default: true },
        metadata: {
            displayName: {
                fr: { type: String, required: true },
                en: { type: String, required: true }
            },
            icon: String,
            category: String
        }
    },
    { timestamps: true }
)

// Indexes
// Note: code index with unique:true is already created via field definition
CompetencySchema.index({ type: 1, isActive: 1 })

const Competency: Model<ICompetency> = mongoose.models.Competency || mongoose.model<ICompetency>('Competency', CompetencySchema)

export default Competency
