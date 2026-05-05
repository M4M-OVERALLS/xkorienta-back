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

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Charger les variables d'environnement
dotenv.config();

// Types d'école
const SchoolType = {
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  HIGHER_ED: "HIGHER_ED",
  TRAINING_CENTER: "TRAINING_CENTER",
  OTHER: "OTHER",
};

// Cycles éducatifs
const Cycle = {
  MATERNELLE: "MATERNELLE",
  PRIMAIRE: "PRIMAIRE",
  COLLEGE: "COLLEGE",
  LYCEE: "LYCEE",
  SUPERIEUR: "SUPERIEUR",
};

/**
 * Déduire le schoolType depuis un cycle
 */
function getSchoolTypeFromCycle(cycle) {
  switch (cycle) {
    case Cycle.PRESCOLAIRE:
    case Cycle.PRIMAIRE:
      return SchoolType.PRIMARY;

    case Cycle.SECONDAIRE_PREMIER_CYCLE:
    case Cycle.SECONDAIRE_SECOND_CYCLE:
      return SchoolType.SECONDARY;

    case Cycle.SUPERIEUR:
      return SchoolType.HIGHER_ED;

    default:
      return SchoolType.SECONDARY; // Par défaut
  }
}

/**
 * Migrer les EducationLevel
 */
async function migrateEducationLevels() {

  const EducationLevel = mongoose.model("EducationLevel");

  // Trouver tous les niveaux sans schoolType
  const levels = await EducationLevel.find({
    $or: [{ schoolType: { $exists: false } }, { schoolType: null }],
  });

  let updated = 0;
  let errors = 0;

  for (const level of levels) {
    try {
      const schoolType = getSchoolTypeFromCycle(level.cycle);

      await EducationLevel.updateOne(
        { _id: level._id },
        { $set: { schoolType } },
      );
      updated++;
    } catch (error) {
      errors++;
    }
  }
  if (errors > 0) {
  }
}

/**
 * Migrer les Exams
 */
async function migrateExams() {

  const Exam = mongoose.model("Exam");
  const EducationLevel = mongoose.model("EducationLevel");

  // Trouver tous les examens sans schoolType
  const exams = await Exam.find({
    $or: [{ schoolType: { $exists: false } }, { schoolType: null }],
  }).populate("targetLevels");

  let updated = 0;
  let errors = 0;

  for (const exam of exams) {
    try {
      let schoolType = SchoolType.SECONDARY; // Par défaut

      if (exam.targetLevels && exam.targetLevels.length > 0) {
        // Récupérer les schoolTypes de tous les niveaux ciblés
        const schoolTypes = exam.targetLevels
          .filter((level) => level && level.schoolType)
          .map((level) => level.schoolType);

        if (schoolTypes.length > 0) {
          // Si tous les niveaux sont du même type → utiliser ce type
          const uniqueTypes = [...new Set(schoolTypes)];

          if (uniqueTypes.length === 1) {
            schoolType = uniqueTypes[0];
          } else {
            // Sinon, prioriser : HIGHER_ED > SECONDARY > PRIMARY
            if (uniqueTypes.includes(SchoolType.HIGHER_ED)) {
              schoolType = SchoolType.HIGHER_ED;
            } else if (uniqueTypes.includes(SchoolType.SECONDARY)) {
              schoolType = SchoolType.SECONDARY;
            } else {
              schoolType = SchoolType.PRIMARY;
            }
          }
        }
      }

      await Exam.updateOne({ _id: exam._id }, { $set: { schoolType } });
      updated++;
    } catch (error) {
      errors++;
    }
  }
  if (errors > 0) {
  }
}

/**
 * Vérifier les résultats de la migration
 */
async function verifyMigration() {

  const EducationLevel = mongoose.model("EducationLevel");
  const Exam = mongoose.model("Exam");

  // Vérifier les EducationLevel
  const levelsWithoutSchoolType = await EducationLevel.countDocuments({
    $or: [{ schoolType: { $exists: false } }, { schoolType: null }],
  });

  const totalLevels = await EducationLevel.countDocuments();

  if (levelsWithoutSchoolType === 0) {
  } else {
  }

  // Vérifier les Exams
  const examsWithoutSchoolType = await Exam.countDocuments({
    $or: [{ schoolType: { $exists: false } }, { schoolType: null }],
  });

  const totalExams = await Exam.countDocuments();

  if (examsWithoutSchoolType === 0) {
  } else {
  }

  // Statistiques par type

  const levelStats = await EducationLevel.aggregate([
    { $group: { _id: "$schoolType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  levelStats.forEach((stat) => {
  });

  const examStats = await Exam.aggregate([
    { $group: { _id: "$schoolType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  examStats.forEach((stat) => {
  });
}

/**
 * Fonction principale
 */
async function main() {
  try {

    // Connexion à MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/Xkorienta",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );

    // Charger les modèles
    require("../src/models/EducationLevel");
    require("../src/models/Exam");

    // Exécuter les migrations
    await migrateEducationLevels();
    await migrateExams();

    // Vérifier les résultats
    await verifyMigration();
  } catch (error) {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Exécuter le script
main();
