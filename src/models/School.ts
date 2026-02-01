import mongoose, { Schema, Document, Model } from 'mongoose'
import { SchoolStatus, ModalityStatus, LanguageStatus, SpecialtyLevel, certificationType } from './enums'

export enum SchoolType {
    PRIMARY = 'PRIMARY',
    SECONDARY = 'SECONDARY',
    HIGHER_ED = 'HIGHER_ED',
    TRAINING_CENTER = 'TRAINING_CENTER',
    OTHER = 'OTHER'
}

export interface ISchool extends Document {
    _id: mongoose.Types.ObjectId
    name: string
    type: SchoolType
    address?: string
    city: mongoose.Types.ObjectId, // clé étrangère city
    country: mongoose.Types.ObjectId, // clé étrangère country
    logoUrl?: string,
    status: SchoolStatus
    contactInfo?: {
        email?: string
        phone?: string
        website?: string
    },

    // Données pour l'orientation
    specialties: mongoose.Types.ObjectId, //clé étrangère du modèle Specialty
    accreditation: mongoose.Types.ObjectId, // clé étrangère du modèle Partner
    tuitionFee: { min: number; max: number; currency: string },
    modality: ModalityStatus,
    Languages: LanguageStatus[],
    // xkorientaScore: number, //Sa valeur est dans le table SchoolScore
    badges: {
        employment: boolean,
        alternance: boolean,
        certification: certificationType[] // Présent dans la table Badge
    }
    academicLevel: mongoose.Types.ObjectId[], // Présent dans la table EducationLevel

    // Données pour la comparaison
    degrees: SpecialtyLevel[],
    //speciality.durationYears?: { min: number; max: number; unit: 'mois' | 'ans' }partnerships?: string[] // Partenariats avec entreprises/universités
    partnerships: mongoose.Types.ObjectId[], // Partenariats avec entreprises/universités
    studentCount: number,
    foundedYear: number,

    //Données pour la page des détails
    description: string,
    learningOutcomes: string[], // mongoose.Types.ObjectId
    careerPaths: mongoose.Types.ObjectId[], // clé étrangère de la table CareerOutcome

    //Débouchés professionneles
    // programs: mongoose.Types.ObjectId[], // Présent dans la table SchoolProgram

    // Relationships
    teachers: mongoose.Types.ObjectId[] // Refs to User
    admins: mongoose.Types.ObjectId[] // Refs to User
    applicants: mongoose.Types.ObjectId[] // Refs to User

    // Metadata
    certificationBadge?: string // URL or Badge ID 
    owner: mongoose.Types.ObjectId // Ref to User (Teacher who created it)
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

const SchoolSchema = new Schema<ISchool>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        type: {
            type: String,
            enum: Object.values(SchoolType),
            default: SchoolType.OTHER
        },
        address: {
            type: String,
            trim: true
        },
        city: {
            type: Schema.Types.ObjectId,
            ref: 'City'
        },
        country: {
            type: Schema.Types.ObjectId,
            ref: 'Country'
        },
        contactInfo: {
            email: String,
            phone: String,
            website: String
        },
        specialties: {
            type: Schema.Types.ObjectId,
            ref: 'Specialty'
        },
        accreditation: {
            type: Schema.Types.ObjectId,
            ref: 'Partner'
        },
        tuitionFee: {
            min: Number,
            max: Number,
            currency: String
        },
        modality: {
            type: String,
            enum: Object.values(ModalityStatus)
        },
        Languages: [{
            type: String,
            enum: Object.values(LanguageStatus)
        }],
        badges: {
            employment: Boolean,
            alternance: Boolean,
            certification: [{
                type: Schema.Types.ObjectId,
                ref: 'Badge'
            }]
        },
        academicLevel: [{
            type: Schema.Types.ObjectId,
            ref: 'EducationLevel'
        }],
        degrees: [{
            type: String,
            enum: Object.values(SpecialtyLevel)
        }],
        partnerships: [{
            type: Schema.Types.ObjectId,
            ref: 'Partner'
        }],
        studentCount: Number,
        foundedYear: Number,
        description: String,
        learningOutcomes: [{
            type: String
        }],
        careerPaths: [{
            type: Schema.Types.ObjectId,
            ref: 'CareerOutcome'
        }],
        teachers: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        admins: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        applicants: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        logoUrl: String,
        certificationBadge: String,
        status: {
            type: String,
            enum: Object.values(SchoolStatus),
            default: SchoolStatus.PENDING
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
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
SchoolSchema.index({ city: 1 })
SchoolSchema.index({ country: 1 })
SchoolSchema.index({ teachers: 1 })
SchoolSchema.index({ admins: 1 })
SchoolSchema.index({ status: 1 })
SchoolSchema.index({ owner: 1 })

const School: Model<ISchool> = mongoose.models.School || mongoose.model<ISchool>('School', SchoolSchema)

export default School