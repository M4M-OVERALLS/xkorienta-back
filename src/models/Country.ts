import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICountry extends Document {
    _id: mongoose.Types.ObjectId
    name: string
    isoCode: string // Code ISO (ex: CM, FR, US)
    currency: string // Code devise (ex: FCFA, EUR, USD)
    createdAt: Date
    updatedAt: Date
}

const CountrySchema = new Schema<ICountry>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        isoCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            length: 2
        },
        currency: {
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
// Note: isoCode and name indexes with unique:true are already created via field definitions

// Prevent model recompilation in development
const Country: Model<ICountry> = mongoose.models.Country || mongoose.model<ICountry>('Country', CountrySchema)

export default Country
