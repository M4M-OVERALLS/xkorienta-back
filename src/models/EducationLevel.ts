import mongoose, { Schema, Document, Model } from 'mongoose'
import { Cycle, SubSystem } from './enums'
import { SchoolType } from './School'

export interface IEducationLevel extends Document {
    name: string
    code: string
    cycle: Cycle
    schoolType: SchoolType // Type d'école (PRIMARY, SECONDARY, HIGHER_ED) - pour filtrage par niveau
    subSystem: SubSystem
    order: number
    isActive: boolean
    metadata: {
        displayName: {
            fr: string
            en: string
        }
        description?: string
    }
    createdAt: Date
    updatedAt: Date
}

const EducationLevelSchema = new Schema<IEducationLevel>(
    {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true },
        cycle: { type: String, enum: Object.values(Cycle), required: true },
        schoolType: { type: String, enum: Object.values(SchoolType), required: true },
        subSystem: { type: String, enum: Object.values(SubSystem), required: true },
        order: { type: Number, required: true },
        isActive: { type: Boolean, default: true },
        metadata: {
            displayName: {
                fr: { type: String, required: true },
                en: { type: String, required: true }
            },
            description: String
        }
    },
    { timestamps: true }
)

// Indexes
EducationLevelSchema.index({ code: 1 }, { unique: true })
EducationLevelSchema.index({ schoolType: 1, subSystem: 1 }) // Filtrage par type d'école
EducationLevelSchema.index({ subSystem: 1, cycle: 1, order: 1 })

const EducationLevel: Model<IEducationLevel> = mongoose.models.EducationLevel || mongoose.model<IEducationLevel>('EducationLevel', EducationLevelSchema)

export default EducationLevel
