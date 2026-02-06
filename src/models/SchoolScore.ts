import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISchoolScore extends Document {
    _id: mongoose.Types.ObjectId
    school: mongoose.Types.ObjectId // Ref: 'School'
    legalScore: number // Score légal/réglementaire (0-100)
    academicScore: number // Score académique (0-100)
    employmentScore: number // Score d'emploi (0-100)
    infrastructureScore: number // Score d'infrastructure (0-100)
    affordabilityScore: number // Score d'accessibilité financière (0-100)
    globalScore: number // Score global (0-100)
    lastComputedAt: Date // Date du dernier calcul
    createdAt: Date
    updatedAt: Date
}

const SchoolScoreSchema = new Schema<ISchoolScore>(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true,
            unique: true
        },
        legalScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        academicScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        employmentScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        infrastructureScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        affordabilityScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        globalScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },
        lastComputedAt: {
            type: Date,
            required: true,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
)

// Indexes
// Note: school index with unique:true is already created via the field definition
SchoolScoreSchema.index({ globalScore: 1 })
SchoolScoreSchema.index({ lastComputedAt: 1 })

// Prevent model recompilation in development
const SchoolScore: Model<ISchoolScore> = mongoose.models.SchoolScore || mongoose.model<ISchoolScore>('SchoolScore', SchoolScoreSchema)

export default SchoolScore
