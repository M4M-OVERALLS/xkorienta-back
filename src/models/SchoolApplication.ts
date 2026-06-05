import mongoose, { Schema, Document, Model } from 'mongoose'
import {
    ApplicationStatus,
    PaymentStatus,
} from './enums'

// ── Sub-document interfaces ─────────────────────────────────────────────────

export interface IDocUpload {
    fieldId: string
    fileUrl: string
    uploadedAt: Date
}

// ── Main interface ──────────────────────────────────────────────────────────

export interface ISchoolApplication extends Document {
    _id: mongoose.Types.ObjectId
    inscriptionFormId: mongoose.Types.ObjectId
    schoolId: mongoose.Types.ObjectId
    userId?: mongoose.Types.ObjectId
    guestEmail?: string
    candidateData: Record<string, unknown>
    parentData: Record<string, unknown>
    domainChoices: string[]
    docsUploaded: IDocUpload[]
    paymentStatus: PaymentStatus
    paymentRef?: string
    transactionId?: mongoose.Types.ObjectId
    invoiceId?: mongoose.Types.ObjectId
    appStatus: ApplicationStatus
    submittedAt?: Date
    paidAt?: Date
    reviewedBy?: mongoose.Types.ObjectId
    reviewedAt?: Date
    reviewNote?: string
    createdAt: Date
    updatedAt: Date
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const DocUploadSchema = new Schema<IDocUpload>(
    {
        fieldId:    { type: String, required: true },
        fileUrl:    { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false },
)

// ── Main schema ─────────────────────────────────────────────────────────────

const SchoolApplicationSchema = new Schema<ISchoolApplication>(
    {
        inscriptionFormId: {
            type: Schema.Types.ObjectId,
            ref: 'InscriptionForm',
            required: true,
            index: true,
        },
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            sparse: true,
        },
        guestEmail: {
            type: String,
            lowercase: true,
            trim: true,
            sparse: true,
        },
        candidateData: {
            type: Schema.Types.Mixed,
            default: {},
        },
        parentData: {
            type: Schema.Types.Mixed,
            default: {},
        },
        domainChoices: {
            type: [String],
            default: [],
        },
        docsUploaded: {
            type: [DocUploadSchema],
            default: [],
        },
        paymentStatus: {
            type: String,
            enum: Object.values(PaymentStatus),
            default: PaymentStatus.PENDING,
        },
        paymentRef: {
            type: String,
            sparse: true,
            unique: true,
        },
        transactionId: {
            type: Schema.Types.ObjectId,
            ref: 'Transaction',
            sparse: true,
        },
        invoiceId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            sparse: true,
        },
        appStatus: {
            type: String,
            enum: Object.values(ApplicationStatus),
            default: ApplicationStatus.DRAFT,
            index: true,
        },
        submittedAt: { type: Date },
        paidAt:      { type: Date },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt:  { type: Date },
        reviewNote:  { type: String, maxlength: 1000 },
    },
    { timestamps: true },
)

// ── Indexes ─────────────────────────────────────────────────────────────────
// Anti-doublon : un user ne peut candidater qu'une fois par fiche
SchoolApplicationSchema.index(
    { inscriptionFormId: 1, userId: 1 },
    { unique: true, sparse: true, partialFilterExpression: { userId: { $exists: true } } },
)
// Admin filtre candidatures par statut
SchoolApplicationSchema.index({ inscriptionFormId: 1, appStatus: 1 })
// Étudiant : ses candidatures
SchoolApplicationSchema.index({ userId: 1, appStatus: 1 })
// Lien anonyme → compte
SchoolApplicationSchema.index({ guestEmail: 1 }, { sparse: true })

// ── Export ───────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'development' && mongoose.models.SchoolApplication) {
    mongoose.deleteModel('SchoolApplication')
}

const SchoolApplication: Model<ISchoolApplication> =
    mongoose.models.SchoolApplication ||
    mongoose.model<ISchoolApplication>('SchoolApplication', SchoolApplicationSchema)

export default SchoolApplication
