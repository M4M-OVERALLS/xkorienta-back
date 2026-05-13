import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/lib/mongodb'
import Media from '../src/models/Media'

/**
 * Migration : Initialise les champs pédagogiques des médias existants.
 *
 * Les médias qui n'ont pas encore les champs targetLevels, targetFields,
 * subjects, difficulty et tags reçoivent des valeurs par défaut (tableaux
 * vides / null). Ces médias auront un score de recommandation faible
 * tant qu'un enseignant ne les enrichit pas.
 *
 * Usage : npx tsx scripts/migrate-media-pedagogical-fields.ts
 */
async function migratePedagogicalFields() {
    try {
        await connectDB()

        const result = await Media.updateMany(
            { targetLevels: { $exists: false } },
            {
                $set: {
                    targetLevels: [],
                    targetFields: [],
                    subjects: [],
                    difficulty: null,
                    tags: [],
                },
            },
        )

        console.log(
            `[Migration] ${result.modifiedCount} médias mis à jour avec les champs pédagogiques.`,
        )

        // Création des index de recommandation
        await Media.collection.createIndex(
            { targetLevels: 1, status: 1 },
            { background: true },
        )
        await Media.collection.createIndex(
            { targetFields: 1, status: 1 },
            { background: true },
        )
        await Media.collection.createIndex(
            { subjects: 1, status: 1 },
            { background: true },
        )
        await Media.collection.createIndex(
            { tags: 1 },
            { background: true },
        )

        console.log('[Migration] Index de recommandation créés.')
    } catch (error) {
        console.error('[Migration] Erreur :', error)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        process.exit(0)
    }
}

migratePedagogicalFields()
