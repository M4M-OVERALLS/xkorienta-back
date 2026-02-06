import mongoose, { Schema, Document, Model } from 'mongoose'

export enum ApprovalStatus {
    ISSUED = 'Issued',
    NOT_ISSUED = 'NotIssued',
    EXPIRED = 'Expired'
}

export interface IRegulatoryApproval extends Document {
    _id: mongoose.Types.ObjectId
    school: mongoose.Types.ObjectId // Ref: 'School'
    approvalNumber: string
    approvalStatus: ApprovalStatus
    approvalDate?: Date
    openingAuthorization?: string
    issuedBy?: mongoose.Types.ObjectId // Ref: 'Partner' // MINESUP, MINEFOP, etc.
    issuedByName?: string
    secondarySupervisions?: string[]
    documentsUrl?: string // URL vers les documents scannés/preuves
    verificationDocs?: string[]
    foreignDiplomasNoAccreditation?: string
    foreignDiplomasWithAccreditation?: string
    createdAt: Date
    updatedAt: Date
}

const RegulatoryApprovalSchema = new Schema<IRegulatoryApproval>(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true
        },
        approvalNumber: {
            type: String,
            required: true,
            trim: true
        },
        approvalStatus: {
            type: String,
            enum: Object.values(ApprovalStatus),
            required: true,
            default: ApprovalStatus.NOT_ISSUED
        },
        approvalDate: {
            type: Date
        },
        openingAuthorization: {
            type: String,
            trim: true
        },
        issuedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Partner',
            required: false
        },
        issuedByName: {
            type: String,
            trim: true
        },
        secondarySupervisions: [{
            type: String,
            trim: true
        }],
        documentsUrl: {
            type: String,
            trim: true
        },
        verificationDocs: [{
            type: String,
            trim: true
        }],
        foreignDiplomasNoAccreditation: {
            type: String,
            trim: true
        },
        foreignDiplomasWithAccreditation: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
)

// Indexes
RegulatoryApprovalSchema.index({ school: 1, approvalNumber: 1 }, { unique: true })
RegulatoryApprovalSchema.index({ school: 1 })
RegulatoryApprovalSchema.index({ approvalStatus: 1 })
RegulatoryApprovalSchema.index({ issuedBy: 1 })

// Prevent model recompilation in development
const RegulatoryApproval: Model<IRegulatoryApproval> = mongoose.models.RegulatoryApproval || mongoose.model<IRegulatoryApproval>('RegulatoryApproval', RegulatoryApprovalSchema)

export default RegulatoryApproval
