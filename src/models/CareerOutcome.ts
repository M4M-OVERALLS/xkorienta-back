import mongoose, { Schema, Document, Model } from 'mongoose'
import { DemandStatus } from './enums'

export interface ICareerOutcome extends Document {
    _id: mongoose.Types.ObjectId
    name: string
    sector: string // Secteur d'activité,
    demand: DemandStatus
    createdAt: Date
    updatedAt: Date
}

const CareerOutcomeSchema = new Schema<ICareerOutcome>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        sector: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
CareerOutcomeSchema.index({ name: 1 }, { unique: true })
CareerOutcomeSchema.index({ sector: 1 })

// Prevent model recompilation in development
const CareerOutcome: Model<ICareerOutcome> = mongoose.models.CareerOutcome || mongoose.model<ICareerOutcome>('CareerOutcome', CareerOutcomeSchema)

export default CareerOutcome
