const mongoose = require('mongoose')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/xkorienta'

const schools = [
    {
        name: "Lycée Bilingue de Douala",
        type: "SECONDARY",
        address: "Avenue de la Liberté",
        city: "Douala",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "contact@lyceedouala.cm",
            phone: "+237 233 42 00 00"
        }
    },
    {
        name: "Lycée Général Leclerc",
        type: "SECONDARY",
        address: "Rue Joseph Essono Balla",
        city: "Yaoundé",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "contact@lgl-yaounde.cm",
            phone: "+237 222 23 00 00"
        }
    },
    {
        name: "CETIC de Yaoundé",
        type: "TRAINING_CENTER",
        address: "Quartier Messa",
        city: "Yaoundé",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "info@cetic-yaounde.cm"
        }
    },
    {
        name: "Institut Supérieur d'Innovation et de Management Marie-Albert (ISIMMA)",
        type: "HIGHER_ED",
        address: "Bonapriso",
        city: "Douala",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "contact@isimma.cm",
            phone: "+237 233 42 50 00"
        }
    },
    {
        name: "Collège Vogt",
        type: "SECONDARY",
        address: "Rue Joffre",
        city: "Yaoundé",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "contact@collegevogt.cm"
        }
    },
    {
        name: "Lycée de Bafoussam",
        type: "SECONDARY",
        address: "Centre-ville",
        city: "Bafoussam",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "lycee.bafoussam@education.cm"
        }
    },
    {
        name: "École Normale Supérieure de Yaoundé",
        type: "HIGHER_ED",
        address: "Campus universitaire",
        city: "Yaoundé",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true,
        contactInfo: {
            email: "ens@uy1.cm"
        }
    },
    {
        name: "Lycée Bilingue de Kribi",
        type: "SECONDARY",
        address: "Route de Kribi",
        city: "Kribi",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    }
]

async function seedSchools() {
    try {
        await mongoose.connect(DATABASE_URL)

        const School = mongoose.model('School', new mongoose.Schema({
            name: String,
            type: String,
            address: String,
            city: String,
            country: String,
            status: String,
            isActive: Boolean,
            contactInfo: Object
        }))

        await School.deleteMany({})

        const result = await School.insertMany(schools)
        
        result.forEach((school, index) => {
        })

        await mongoose.connection.close()
        process.exit(0)
    } catch (error) {
        process.exit(1)
    }
}

seedSchools()
