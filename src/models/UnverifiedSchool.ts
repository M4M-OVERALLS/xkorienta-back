import mongoose, { Schema, Document, Model } from 'mongoose'

export type UnverifiedSchoolStatus = 'PENDING' | 'VALIDATED' | 'MERGED' | 'REJECTED'

export interface IUnverifiedSchool extends Document {
    _id: mongoose.Types.ObjectId

    // Informations saisies par l'apprenant
    declaredName: string       // Nom normalisé (lowercase, trimmed)
    declaredCity?: string
    declaredCountry?: string
    declaredType?: string       // "Lycée", "Collège", "Université", etc.

    // Traçabilité
    declaredBy: mongoose.Types.ObjectId[] // Ref: User[]
    declaredCount: number

    // Matching et validation
    status: UnverifiedSchoolStatus
    matchedSchool?: mongoose.Types.ObjectId // Ref: School — si liée à une école validée

    // Métadonnées
    notes?: string
    createdAt: Date
    updatedAt: Date
}

const UnverifiedSchoolSchema = new Schema<IUnverifiedSchool>(
    {
        declaredName: {
            type: String,
            required: true,
            maxlength: 200,
            trim: true
        },
        declaredCity: {
            type: String,
            maxlength: 100,
            trim: true
        },
        declaredCountry: {
            type: String,
            maxlength: 100,
            trim: true
        },
        declaredType: {
            type: String,
            maxlength: 50,
            trim: true
        },

        declaredBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        declaredCount: { type: Number, default: 1 },

        status: {
            type: String,
            enum: ['PENDING', 'VALIDATED', 'MERGED', 'REJECTED'],
            default: 'PENDING'
        },
        matchedSchool: { type: Schema.Types.ObjectId, ref: 'School' },

        notes: { type: String, maxlength: 1000 }
    },
    { timestamps: true }
)

// Indexes
UnverifiedSchoolSchema.index({ declaredName: 'text' }) // Full-text search
UnverifiedSchoolSchema.index({ status: 1 })
UnverifiedSchoolSchema.index({ declaredCount: -1 }) // Prioriser les plus populaires
UnverifiedSchoolSchema.index({ declaredBy: 1 })
UnverifiedSchoolSchema.index({ declaredName: 1, status: 1 }) // Déduplication

const UnverifiedSchool: Model<IUnverifiedSchool> =
    mongoose.models.UnverifiedSchool ||
    mongoose.model<IUnverifiedSchool>('UnverifiedSchool', UnverifiedSchoolSchema)

export default UnverifiedSchool
