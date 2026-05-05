import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IXkorientaRegistration extends Document {
    student: {
        school: string
        firstName: string
        lastName: string
        phone: string
        email: string
        neighborhood: string
        class: string
        specialty: string
    }
    parent: {
        fullName: string
        phone: string
        email: string
    }
    createdAt: Date
    updatedAt: Date
}

const XkorientaRegistrationSchema = new Schema<IXkorientaRegistration>(
    {
        student: {
            school: { type: String, required: true },
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            phone: { type: String, required: true },
            email: { type: String, required: true },
            neighborhood: { type: String, required: true },
            class: { type: String, required: true },
            specialty: { type: String, required: true }
        },
        parent: {
            fullName: { type: String, required: true },
            phone: { type: String, required: true },
            email: { type: String, required: true }
        }
    },
    {
        timestamps: true
    }
)

const XkorientaRegistration: Model<IXkorientaRegistration> = mongoose.models.XkorientaRegistration || mongoose.model<IXkorientaRegistration>('XkorientaRegistration', XkorientaRegistrationSchema)

export default XkorientaRegistration
