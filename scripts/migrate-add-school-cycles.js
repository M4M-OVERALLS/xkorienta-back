/**
 * Script de migration : Ajouter le champ cycles aux écoles
 *
 * Ce script peuple le champ cycles dans la collection School en fonction du type d'école.
 *
 * Logique :
 * - PRIMARY → [MATERNELLE, PRIMAIRE] (par défaut, école complète)
 * - SECONDARY → [COLLEGE, LYCEE] (par défaut, établissement combiné)
 * - HIGHER_ED → [SUPERIEUR] ou [LICENCE, MASTER] selon les niveaux académiques
 * - TRAINING_CENTER → Pas de cycles (ne s'applique pas)
 * - OTHER → Pas de cycles
 *
 * Usage : node scripts/migrate-add-school-cycles.js
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
  LICENCE: "LICENCE",
  MASTER: "MASTER",
  SUPERIEUR: "SUPERIEUR",
};

/**
 * Déduire les cycles depuis le type d'école
 */
function getCyclesFromSchoolType(schoolType) {
  switch (schoolType) {
    case SchoolType.PRIMARY:
      // École primaire complète (maternelle + primaire)
      return [Cycle.PRESCOLAIRE, Cycle.PRIMAIRE];

    case SchoolType.SECONDARY:
      // Établissement secondaire combiné (collège + lycée)
      return [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE];

    case SchoolType.HIGHER_ED:
      // Enseignement supérieur (valeur générique)
      return [Cycle.SUPERIEUR];

    default:
      // Autres types : pas de cycles
      return [];
  }
}

/**
 * Déduire les cycles pour une école HIGHER_ED en fonction des niveaux académiques
 */
async function deduceHigherEdCycles(school) {
  if (!school.academicLevel || school.academicLevel.length === 0) {
    // Pas de niveaux académiques → utiliser SUPERIEUR générique
    return [Cycle.SUPERIEUR];
  }

  try {
    const EducationLevel = mongoose.model("EducationLevel");
    const levels = await EducationLevel.find({
      _id: { $in: school.academicLevel },
    }).select("cycle");

    const cycles = levels.map((l) => l.cycle).filter(Boolean);
    const uniqueCycles = [...new Set(cycles)];

    // Si on a des cycles LICENCE et/ou MASTER, les utiliser
    const relevantCycles = uniqueCycles.filter((c) =>
      [Cycle.LICENCE, Cycle.MASTER, Cycle.SUPERIEUR].includes(c),
    );

    return relevantCycles.length > 0 ? relevantCycles : [Cycle.SUPERIEUR];
  } catch (error) {
    console.error(
      "Erreur lors de la déduction des cycles HIGHER_ED:",
      error.message,
    );
    return [Cycle.SUPERIEUR];
  }
}

/**
 * Migrer les écoles
 */
async function migrateSchools() {
  console.log("\n=== Migration des cycles des écoles ===");

  const School = mongoose.model("School");

  // Trouver toutes les écoles sans cycles
  const schools = await School.find({
    $or: [{ cycles: { $exists: false } }, { cycles: null }, { cycles: [] }],
  });

  console.log(`📊 Écoles à migrer : ${schools.length}`);

  let updated = 0;
  let errors = 0;

  for (const school of schools) {
    try {
      let cycles = [];

      if (school.type === SchoolType.HIGHER_ED) {
        // Cas spécial : déduire depuis les niveaux académiques
        cycles = await deduceHigherEdCycles(school);
      } else {
        // Cas standard : déduire depuis le type
        cycles = getCyclesFromSchoolType(school.type);
      }

      if (cycles.length > 0) {
        await School.updateOne({ _id: school._id }, { $set: { cycles } });

        console.log(
          `✅ ${school.name} (${school.type}) → ${cycles.join(", ")}`,
        );
        updated++;
      } else {
        console.log(
          `⏭️ ${school.name} (${school.type}) → Pas de cycles applicables`,
        );
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${school.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ Écoles migrées : ${updated}`);
  if (errors > 0) {
    console.log(`⚠️ Erreurs : ${errors}`);
  }
}

/**
 * Vérifier les résultats de la migration
 */
async function verifyMigration() {
  console.log("\n=== Vérification de la migration ===");

  const School = mongoose.model("School");

  // Vérifier les écoles sans cycles
  const schoolsWithoutCycles = await School.countDocuments({
    $or: [{ cycles: { $exists: false } }, { cycles: null }, { cycles: [] }],
  });

  const totalSchools = await School.countDocuments();

  console.log(`\n📊 Écoles :`);
  console.log(`   - Total : ${totalSchools}`);
  console.log(`   - Avec cycles : ${totalSchools - schoolsWithoutCycles}`);
  console.log(`   - Sans cycles : ${schoolsWithoutCycles}`);

  if (schoolsWithoutCycles === 0) {
    console.log(`   ✅ Toutes les écoles ont des cycles définis`);
  } else {
    console.log(
      `   ℹ️ ${schoolsWithoutCycles} écoles sans cycles (normal pour TRAINING_CENTER et OTHER)`,
    );
  }

  // Statistiques par type
  console.log(`\n📊 Répartition par type d'école :`);

  const stats = await School.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        cycles: { $addToSet: "$cycles" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  stats.forEach((stat) => {
    console.log(`\n   ${stat._id || "NULL"} : ${stat.count} école(s)`);
    if (stat.cycles && stat.cycles.length > 0) {
      stat.cycles.forEach((cycleArray) => {
        if (cycleArray && cycleArray.length > 0) {
          console.log(`      └─ Cycles : ${cycleArray.join(", ")}`);
        }
      });
    }
  });
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log("🚀 Démarrage de la migration des cycles...");
    console.log(
      `📡 Connexion à MongoDB : ${process.env.MONGODB_URI?.split("@")[1] || "localhost"}`,
    );

    // Connexion à MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/Xkorienta",
    );

    console.log("✅ Connecté à MongoDB");

    // Charger les modèles
    require("../src/models/School");
    require("../src/models/EducationLevel");

    // Exécuter la migration
    await migrateSchools();

    // Vérifier les résultats
    await verifyMigration();

    console.log("\n✅ Migration terminée avec succès !");
  } catch (error) {
    console.error("\n❌ Erreur lors de la migration:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Connexion fermée");
  }
}

// Exécuter le script
main();
