/**
 * Script de migration : Ajouter le champ schoolType
 *
 * Ce script peuple le champ schoolType dans les collections Exam et EducationLevel existantes.
 *
 * Logique :
 * 1. Pour EducationLevel : déduire schoolType depuis le cycle
 *    - MATERNELLE, PRIMAIRE → PRIMARY
 *    - COLLEGE, LYCEE → SECONDARY
 *    - SUPERIEUR → HIGHER_ED
 *
 * 2. Pour Exam : déduire schoolType depuis les targetLevels
 *    - Si tous les niveaux sont PRIMARY → PRIMARY
 *    - Si tous les niveaux sont SECONDARY → SECONDARY
 *    - Si tous les niveaux sont HIGHER_ED → HIGHER_ED
 *    - Sinon → SECONDARY (par défaut pour les examens multi-niveaux)
 *
 * Usage : node scripts/migrate-add-school-type.js
 */

const mongoose = require('mongoose')
const dotenv = require('dotenv')

// Charger les variables d'environnement
dotenv.config()

// Types d'école
const SchoolType = {
    PRIMARY: 'PRIMARY',
    SECONDARY: 'SECONDARY',
    HIGHER_ED: 'HIGHER_ED',
    TRAINING_CENTER: 'TRAINING_CENTER',
    OTHER: 'OTHER'
}

// Cycles éducatifs
const Cycle = {
    MATERNELLE: 'MATERNELLE',
    PRIMAIRE: 'PRIMAIRE',
    COLLEGE: 'COLLEGE',
    LYCEE: 'LYCEE',
    SUPERIEUR: 'SUPERIEUR'
}

/**
 * Déduire le schoolType depuis un cycle
 */
function getSchoolTypeFromCycle(cycle) {
    switch (cycle) {
        case Cycle.PRESCOLAIRE:
        case Cycle.PRIMAIRE:
            return SchoolType.PRIMARY

        case Cycle.SECONDAIRE_PREMIER_CYCLE:
        case Cycle.SECONDAIRE_SECOND_CYCLE:
            return SchoolType.SECONDARY

        case Cycle.SUPERIEUR:
            return SchoolType.HIGHER_ED

        default:
            return SchoolType.SECONDARY // Par défaut
    }
}

/**
 * Migrer les EducationLevel
 */
async function migrateEducationLevels() {
    console.log('\n=== Migration des EducationLevel ===')

    const EducationLevel = mongoose.model('EducationLevel')

    // Trouver tous les niveaux sans schoolType
    const levels = await EducationLevel.find({
        $or: [
            { schoolType: { $exists: false } },
            { schoolType: null }
        ]
    })

    console.log(`📊 Niveaux à migrer : ${levels.length}`)

    let updated = 0
    let errors = 0

    for (const level of levels) {
        try {
            const schoolType = getSchoolTypeFromCycle(level.cycle)

            await EducationLevel.updateOne(
                { _id: level._id },
                { $set: { schoolType } }
            )

            console.log(`✅ ${level.name} (${level.cycle}) → ${schoolType}`)
            updated++
        } catch (error) {
            console.error(`❌ Erreur pour ${level.name}:`, error.message)
            errors++
        }
    }

    console.log(`\n✅ EducationLevels migrés : ${updated}`)
    if (errors > 0) {
        console.log(`⚠️ Erreurs : ${errors}`)
    }
}

/**
 * Migrer les Exams
 */
async function migrateExams() {
    console.log('\n=== Migration des Exams ===')

    const Exam = mongoose.model('Exam')
    const EducationLevel = mongoose.model('EducationLevel')

    // Trouver tous les examens sans schoolType
    const exams = await Exam.find({
        $or: [
            { schoolType: { $exists: false } },
            { schoolType: null }
        ]
    }).populate('targetLevels')

    console.log(`📊 Examens à migrer : ${exams.length}`)

    let updated = 0
    let errors = 0

    for (const exam of exams) {
        try {
            let schoolType = SchoolType.SECONDARY // Par défaut

            if (exam.targetLevels && exam.targetLevels.length > 0) {
                // Récupérer les schoolTypes de tous les niveaux ciblés
                const schoolTypes = exam.targetLevels
                    .filter(level => level && level.schoolType)
                    .map(level => level.schoolType)

                if (schoolTypes.length > 0) {
                    // Si tous les niveaux sont du même type → utiliser ce type
                    const uniqueTypes = [...new Set(schoolTypes)]

                    if (uniqueTypes.length === 1) {
                        schoolType = uniqueTypes[0]
                    } else {
                        // Sinon, prioriser : HIGHER_ED > SECONDARY > PRIMARY
                        if (uniqueTypes.includes(SchoolType.HIGHER_ED)) {
                            schoolType = SchoolType.HIGHER_ED
                        } else if (uniqueTypes.includes(SchoolType.SECONDARY)) {
                            schoolType = SchoolType.SECONDARY
                        } else {
                            schoolType = SchoolType.PRIMARY
                        }
                    }
                }
            }

            await Exam.updateOne(
                { _id: exam._id },
                { $set: { schoolType } }
            )

            console.log(`✅ ${exam.title} → ${schoolType}`)
            updated++
        } catch (error) {
            console.error(`❌ Erreur pour ${exam.title}:`, error.message)
            errors++
        }
    }

    console.log(`\n✅ Examens migrés : ${updated}`)
    if (errors > 0) {
        console.log(`⚠️ Erreurs : ${errors}`)
    }
}

/**
 * Vérifier les résultats de la migration
 */
async function verifyMigration() {
    console.log('\n=== Vérification de la migration ===')

    const EducationLevel = mongoose.model('EducationLevel')
    const Exam = mongoose.model('Exam')

    // Vérifier les EducationLevel
    const levelsWithoutSchoolType = await EducationLevel.countDocuments({
        $or: [
            { schoolType: { $exists: false } },
            { schoolType: null }
        ]
    })

    const totalLevels = await EducationLevel.countDocuments()

    console.log(`\n📊 EducationLevel :`)
    console.log(`   - Total : ${totalLevels}`)
    console.log(`   - Avec schoolType : ${totalLevels - levelsWithoutSchoolType}`)
    console.log(`   - Sans schoolType : ${levelsWithoutSchoolType}`)

    if (levelsWithoutSchoolType === 0) {
        console.log(`   ✅ Tous les niveaux ont un schoolType`)
    } else {
        console.log(`   ⚠️ Certains niveaux n'ont pas de schoolType`)
    }

    // Vérifier les Exams
    const examsWithoutSchoolType = await Exam.countDocuments({
        $or: [
            { schoolType: { $exists: false } },
            { schoolType: null }
        ]
    })

    const totalExams = await Exam.countDocuments()

    console.log(`\n📊 Exam :`)
    console.log(`   - Total : ${totalExams}`)
    console.log(`   - Avec schoolType : ${totalExams - examsWithoutSchoolType}`)
    console.log(`   - Sans schoolType : ${examsWithoutSchoolType}`)

    if (examsWithoutSchoolType === 0) {
        console.log(`   ✅ Tous les examens ont un schoolType`)
    } else {
        console.log(`   ⚠️ Certains examens n'ont pas de schoolType`)
    }

    // Statistiques par type
    console.log(`\n📊 Répartition par type d'école :`)

    const levelStats = await EducationLevel.aggregate([
        { $group: { _id: '$schoolType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ])

    console.log(`\n   EducationLevel :`)
    levelStats.forEach(stat => {
        console.log(`   - ${stat._id || 'NULL'} : ${stat.count}`)
    })

    const examStats = await Exam.aggregate([
        { $group: { _id: '$schoolType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ])

    console.log(`\n   Exam :`)
    examStats.forEach(stat => {
        console.log(`   - ${stat._id || 'NULL'} : ${stat.count}`)
    })
}

/**
 * Fonction principale
 */
async function main() {
    try {
        console.log('🚀 Démarrage de la migration schoolType...')
        console.log(`📡 Connexion à MongoDB : ${process.env.MONGODB_URI?.split('@')[1] || 'localhost'}`)

        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quizlock', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })

        console.log('✅ Connecté à MongoDB')

        // Charger les modèles
        require('../src/models/EducationLevel')
        require('../src/models/Exam')

        // Exécuter les migrations
        await migrateEducationLevels()
        await migrateExams()

        // Vérifier les résultats
        await verifyMigration()

        console.log('\n✅ Migration terminée avec succès !')
    } catch (error) {
        console.error('\n❌ Erreur lors de la migration:', error)
        process.exit(1)
    } finally {
        await mongoose.connection.close()
        console.log('\n👋 Connexion fermée')
    }
}

// Exécuter le script
main()
