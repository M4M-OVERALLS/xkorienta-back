import mongoose, { Schema, Document, Model } from 'mongoose'
import {
    InscriptionFormStatus,
    FormFieldType,
} from './enums'

// ── Sub-document interfaces ─────────────────────────────────────────────────

export interface IFormField {
    id: string
    type: FormFieldType
    label: string
    required: boolean
    options: string[]
    group?: string
}

export interface IDomainGroup {
    name: string
    fields: string[]
}

// ── Main interface ──────────────────────────────────────────────────────────

export interface IInscriptionForm extends Document {
    _id: mongoose.Types.ObjectId
    schoolId: mongoose.Types.ObjectId
    title: string
    status: InscriptionFormStatus
    formFields: IFormField[]
    docsRequired: string[]
    domainGroups: IDomainGroup[]
    price: number
    commissionRate: number
    opensAt: Date
    closesAt: Date
    maxCandidates?: number
    currentCandidates: number
    description?: string
    createdBy: mongoose.Types.ObjectId
    createdAt: Date
    updatedAt: Date
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const FormFieldSchema = new Schema<IFormField>(
    {
        id:       { type: String, required: true },
        type:     { type: String, enum: Object.values(FormFieldType), required: true },
        label:    { type: String, required: true },
        required: { type: Boolean, default: false },
        options:  [{ type: String }],
        group:    { type: String },
    },
    { _id: false },
)

const DomainGroupSchema = new Schema<IDomainGroup>(
    {
        name:   { type: String, required: true },
        fields: [{ type: String }],
    },
    { _id: false },
)

// ── Main schema ─────────────────────────────────────────────────────────────

const InscriptionFormSchema = new Schema<IInscriptionForm>(
    {
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        status: {
            type: String,
            enum: Object.values(InscriptionFormStatus),
            default: InscriptionFormStatus.DRAFT,
            index: true,
        },
        formFields: {
            type: [FormFieldSchema],
            default: [],
        },
        docsRequired: {
            type: [String],
            default: [],
        },
        domainGroups: {
            type: [DomainGroupSchema],
            default: [],
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        commissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        opensAt: {
            type: Date,
            required: true,
        },
        closesAt: {
            type: Date,
            required: true,
        },
        maxCandidates: {
            type: Number,
            min: 1,
        },
        currentCandidates: {
            type: Number,
            default: 0,
            min: 0,
        },
        description: {
            type: String,
            maxlength: 5000,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
    },
    { timestamps: true },
)

// ── Indexes ─────────────────────────────────────────────────────────────────
// Liste publique : fiches publiées triées par deadline
InscriptionFormSchema.index({ status: 1, closesAt: 1 })
// Admin : fiches de son école
InscriptionFormSchema.index({ schoolId: 1, status: 1 })

// ── Export ───────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'development' && mongoose.models.InscriptionForm) {
    mongoose.deleteModel('InscriptionForm')
}

const InscriptionForm: Model<IInscriptionForm> =
    mongoose.models.InscriptionForm ||
    mongoose.model<IInscriptionForm>('InscriptionForm', InscriptionFormSchema)

export default InscriptionForm
