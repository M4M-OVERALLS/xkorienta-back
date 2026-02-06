import mongoose, { Schema, Document, Model } from 'mongoose'

export enum SkillType {
    GENERIC = 'Generic',
    SPECIFIC = 'Specific'
}

export interface ISkill extends Document {
    _id: mongoose.Types.ObjectId
    name: string
    skillType: SkillType
    createdAt: Date
    updatedAt: Date
}

const SkillSchema = new Schema<ISkill>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        skillType: {
            type: String,
            enum: Object.values(SkillType),
            required: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
// Note: name index with unique:true is already created via field definition
SkillSchema.index({ skillType: 1 })

// Prevent model recompilation in development
const Skill: Model<ISkill> = mongoose.models.Skill || mongoose.model<ISkill>('Skill', SkillSchema)

export default Skill
