const mongoose = require('mongoose')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/xkorienta'

const marieAlbertSchools = [
    {
        name: "Collège Marie Albert Prestige",
        type: "SECONDARY_GENERAL",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    },
    {
        name: "College Marie Albert II",
        type: "SECONDARY_GENERAL",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    },
    {
        name: "Collège Marie Albert Excellence",
        type: "SECONDARY_GENERAL",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    },
    {
        name: "École Privée Marie Albert Excellence",
        type: "SECONDARY_GENERAL",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    },
    {
        name: "École Maternelle et Primaire Marie Albert Biteng",
        type: "PRIMARY",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    },
    {
        name: "Groupe Scolaire Marie Albert Prestige",
        type: "SECONDARY_GENERAL",
        country: "Cameroun",
        status: "VALIDATED",
        isActive: true
    }
]

const SchoolSchema = new mongoose.Schema({
    name: String,
    type: String,
    address: String,
    city: String,
    country: String,
    status: String,
    isActive: Boolean,
    contactInfo: Object,
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true, strict: false })

async function seedMarieAlbertSchools() {
    try {
        await mongoose.connect(DATABASE_URL)
        console.log('Connected to database')

        const School = mongoose.models.School || mongoose.model('School', SchoolSchema)

        let created = 0
        let skipped = 0

        for (const schoolData of marieAlbertSchools) {
            const exists = await School.findOne({ name: schoolData.name })
            if (exists) {
                console.log(`⏭️  Already exists: ${schoolData.name}`)
                skipped++
            } else {
                await School.create(schoolData)
                console.log(`✅ Created: ${schoolData.name}`)
                created++
            }
        }

        console.log(`\nDone: ${created} created, ${skipped} already existed`)
        await mongoose.connection.close()
        process.exit(0)
    } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
    }
}

seedMarieAlbertSchools()
