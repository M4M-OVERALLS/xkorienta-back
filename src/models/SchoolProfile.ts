import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPartnerEntry {
    name: string
    sector?: string
    type?: string
    proof?: string
    country?: string
    website?: string
}

export interface ISchoolProfile extends Document {
    _id: mongoose.Types.ObjectId
    school: mongoose.Types.ObjectId // Ref: 'School'
    identity?: {
        typeLabel?: string
        cityName?: string
        departmentName?: string
        regionName?: string
        countryName?: string
        address?: string
        website?: string
        contactEmail?: string
        contactPhone?: string
    }
    training?: {
        dominantFields?: string[]
        dominantSpecialties?: string[]
        specialtiesOffered?: string[]
        diplomas?: string[]
        teachingLanguages?: string[]
        modalities?: string
    }
    performance?: {
        yearsOfExistence?: string
        successRates?: string
        officialRanking?: string
        accreditations?: string
    }
    insertion?: {
        localPartners?: IPartnerEntry[]
        internationalPartners?: IPartnerEntry[]
        internshipAgreements?: string
        internshipAgreementCount?: string
        alumniTracking?: string
        alumniExamples?: string
        topRecruiters?: string[]
        insertionRate6?: string
        insertionRate12?: string
    }
    infrastructure?: {
        campusCompliant?: string
        libraryResources?: string
        libraryQuality?: string
        labs?: string
        labEquipment?: string
        itPark?: string
        itParkVolume?: string
        internetQuality?: string
        accessibility?: string
        safetyNotes?: string
    }
    financial?: {
        annualCost?: string
        feeRegistration?: string
        feeTuition?: string
        feeExams?: string
        feeMaterials?: string
        otherFees?: string
        scholarships?: string
        cityCostOfLiving?: string
    }
    studentExperience?: {
        clubs?: string
        mentoring?: string
        satisfactionRate?: string
        mobility?: string
        discipline?: string
    }
    createdAt: Date
    updatedAt: Date
}

const PartnerEntrySchema = new Schema<IPartnerEntry>(
    {
        name: { type: String, required: true, trim: true },
        sector: { type: String, trim: true },
        type: { type: String, trim: true },
        proof: { type: String, trim: true },
        country: { type: String, trim: true },
        website: { type: String, trim: true }
    },
    { _id: false }
)

const SchoolProfileSchema = new Schema<ISchoolProfile>(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true,
            unique: true
        },
        identity: {
            typeLabel: { type: String, trim: true },
            cityName: { type: String, trim: true },
            departmentName: { type: String, trim: true },
            regionName: { type: String, trim: true },
            countryName: { type: String, trim: true },
            address: { type: String, trim: true },
            website: { type: String, trim: true },
            contactEmail: { type: String, trim: true },
            contactPhone: { type: String, trim: true }
        },
        training: {
            dominantFields: [{ type: String, trim: true }],
            dominantSpecialties: [{ type: String, trim: true }],
            specialtiesOffered: [{ type: String, trim: true }],
            diplomas: [{ type: String, trim: true }],
            teachingLanguages: [{ type: String, trim: true }],
            modalities: { type: String, trim: true }
        },
        performance: {
            yearsOfExistence: { type: String, trim: true },
            successRates: { type: String, trim: true },
            officialRanking: { type: String, trim: true },
            accreditations: { type: String, trim: true }
        },
        insertion: {
            localPartners: [PartnerEntrySchema],
            internationalPartners: [PartnerEntrySchema],
            internshipAgreements: { type: String, trim: true },
            internshipAgreementCount: { type: String, trim: true },
            alumniTracking: { type: String, trim: true },
            alumniExamples: { type: String, trim: true },
            topRecruiters: [{ type: String, trim: true }],
            insertionRate6: { type: String, trim: true },
            insertionRate12: { type: String, trim: true }
        },
        infrastructure: {
            campusCompliant: { type: String, trim: true },
            libraryResources: { type: String, trim: true },
            libraryQuality: { type: String, trim: true },
            labs: { type: String, trim: true },
            labEquipment: { type: String, trim: true },
            itPark: { type: String, trim: true },
            itParkVolume: { type: String, trim: true },
            internetQuality: { type: String, trim: true },
            accessibility: { type: String, trim: true },
            safetyNotes: { type: String, trim: true }
        },
        financial: {
            annualCost: { type: String, trim: true },
            feeRegistration: { type: String, trim: true },
            feeTuition: { type: String, trim: true },
            feeExams: { type: String, trim: true },
            feeMaterials: { type: String, trim: true },
            otherFees: { type: String, trim: true },
            scholarships: { type: String, trim: true },
            cityCostOfLiving: { type: String, trim: true }
        },
        studentExperience: {
            clubs: { type: String, trim: true },
            mentoring: { type: String, trim: true },
            satisfactionRate: { type: String, trim: true },
            mobility: { type: String, trim: true },
            discipline: { type: String, trim: true }
        }
    },
    {
        timestamps: true
    }
)

// Note: school index with unique:true is already created via field definition
SchoolProfileSchema.index({ "identity.countryName": 1 })
SchoolProfileSchema.index({ "training.dominantFields": 1 })

const SchoolProfile: Model<ISchoolProfile> = mongoose.models.SchoolProfile || mongoose.model<ISchoolProfile>('SchoolProfile', SchoolProfileSchema)

export default SchoolProfile
