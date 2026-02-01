import mongoose, { Schema, Document, Model } from 'mongoose'
import { SpecialtyLevel, SpecialtyMode, LanguageStatus, degreeAwardedStatus  } from './enums'



export interface ISpecialty extends Document {
    _id: mongoose.Types.ObjectId
    domain: string // Domaine d'études
    field: string // Filière
    specialtyName: string
    level: SpecialtyLevel
    degreeAwarded: degreeAwardedStatus // Diplôme délivré
    durationYears: number // Durée en années
    employability: number // Taux d'employabilité en %
    language: LanguageStatus[] // Langue d'enseignement
    mode: SpecialtyMode
    prerequisites?: string[] // Prérequis
    generalObjective?: string // Objectif général
    specificObjectives?: string[] // Objectifs spécifiques
    valueProposition?: string // Proposition de valeur
    exitProfile?: string // Profil de sortie
    createdAt: Date
    updatedAt: Date
}

const SpecialtySchema = new Schema<ISpecialty>(
    {
        domain: {
            type: String,
            required: true,
            trim: true
        },
        field: {
            type: String,
            required: true,
            trim: true
        },
        specialtyName: {
            type: String,
            required: true,
            trim: true
        },
        level: {
            type: String,
            enum: Object.values(SpecialtyLevel),
            required: true
        },
        degreeAwarded: {
            type: String,
            required: true,
            trim: true
        },
        durationYears: {
            type: Number,
            required: true,
            min: 1
        },
        language: {
            type: String,
            required: true,
            trim: true
        },
        mode: {
            type: String,
            enum: Object.values(SpecialtyMode),
            required: true
        },
        prerequisites: {
            type: String,
            trim: true
        },
        generalObjective: {
            type: String,
            trim: true
        },
        specificObjectives: [{
            type: String,
            trim: true
        }],
        valueProposition: {
            type: String,
            trim: true
        },
        exitProfile: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
SpecialtySchema.index({ domain: 1, field: 1 })
SpecialtySchema.index({ level: 1 })
SpecialtySchema.index({ mode: 1 })
SpecialtySchema.index({ language: 1 })
SpecialtySchema.index({ specialtyName: 1 })

// Prevent model recompilation in development
const Specialty: Model<ISpecialty> = mongoose.models.Specialty || mongoose.model<ISpecialty>('Specialty', SpecialtySchema)

export default Specialty
