/**
 * Restaure les enseignants ISIMMA S2 en base.
 * Chaque compte est créé avec requiresPasswordChange: true.
 * Au login (n'importe quel mot de passe), ils sont redirigés vers
 * /change-password pour définir leur propre mot de passe.
 *
 * Usage :
 *   node scripts/restore-teachers-isimma.js --dry-run
 *   node scripts/restore-teachers-isimma.js
 *   node scripts/restore-teachers-isimma.js --school-id 123abc
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

// ─── Config ─────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes("--dry-run");

const schoolIdArg = process.argv.find((_, i) => process.argv[i - 1] === "--school-id");
const SCHOOL_ID = schoolIdArg || "6932d5e2daa16626073519e5";

// ─── Enseignants ISIMMA S2 ─────────────────────────────────────────────────

const TEACHERS = [
  // ── Génie Logiciel S2 ──────────────────────────────────────────────────
  { name: "DR EBODE Pie Désiré",               email: "piedesir@gmail.com" },
  { name: "DR KOUAM KAMWA Cyrille",             email: "kokacardero@gmail.com" },
  { name: "M. HENDRIGUE NKOLO Joseph",          email: "josephejuniors@gmail.com" },
  { name: "M. KOUAZE NANA Alexis",              email: "alexkouayep@yahoo.fr" },
  { name: "M. MBIDA Derrick",                   email: "mbidaderrick@yahoo.com" },
  { name: "M. NJIKI Ulrich Landry",             email: "articenjiki@gmail.com" },
  { name: "M. TCHANDO NKINASSI Cladore",        email: "shadocladore@gmail.com" },
  { name: "Mme MELONO NOMO Gaëlle Joséphine",  email: "gjmelono@gmail.com" },
  { name: "Pr LEMANA ONANA Serge",              email: "sergelemanaonana@gmail.com" },

  // ── E-Commerce & Marketing Numérique S2 ───────────────────────────────
  { name: "M. NKOGO ONGUEDOU Aurélien",        email: "nkogoghislain@yahoo.fr" },
  { name: "M. NOAH Armand Roméo",              email: "noaharmand7@gmail.com" },
  { name: "Mme MATIA ABANDA Maguy Laurence",    email: "maguylaurence@gmail.com" },

  // ── Gestion Logistique et Transport S2 ────────────────────────────────
  { name: "Mme NYOUNG Antoinette",              email: "contact@ramae.org" },
  { name: "Mme THIAKANE Cécile",               email: "cthiakane@gmail.com" },

  // ── Données retrouvées ────────────────────────────────────────────────
  { name: "M. BIDZANA DENGOUE Erwin Chrystal",  email: "erwinbidzana@gmail.com" },

  // ── Ajouts manuels ───────────────────────────────────────────────────
  { name: "Mme LEKUNG Amerline",                email: "lekungamerline2025@gmail.com" },
  { name: "M. KOUSSITA Dennou",                 email: "koussitadennou08@gmail.com" },
  { name: "Mme NGO Cécile",                     email: "cecilengo895@gmail.com" },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant dans .env");
    process.exit(1);
  }

  console.log(DRY_RUN ? "🔍 Mode DRY-RUN — aucune écriture\n" : "🚀 Mode réel\n");
  console.log(`School ID   : ${SCHOOL_ID}`);
  console.log(`Enseignants : ${TEACHERS.length}\n`);

  if (!DRY_RUN) {
    await mongoose.connect(DATABASE_URL);
    console.log("✅ Connecté à MongoDB\n");
  }

  const User = DRY_RUN ? null : mongoose.model(
    "User",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "users"
  );

  const School = DRY_RUN ? null : mongoose.model(
    "School",
    new mongoose.Schema({}, { strict: false }),
    "schools"
  );

  // Mot de passe aléatoire (inutilisé — le login bypass le mdp quand requiresPasswordChange=true)
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const results = { created: 0, skipped: 0 };

  for (const teacher of TEACHERS) {
    const email = teacher.email.toLowerCase().trim();
    process.stdout.write(`→ ${teacher.name} <${email}> ... `);

    if (DRY_RUN) {
      console.log("(dry-run) serait créé");
      continue;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("⚠️  déjà existant — ignoré");
      results.skipped++;
      continue;
    }

    const newUser = await User.create({
      name: teacher.name,
      email,
      role: "TEACHER",
      password: placeholderHash,
      schools: [new mongoose.Types.ObjectId(SCHOOL_ID)],
      isActive: true,
      tokenVersion: 0,
      loginAttempts: 0,
      requiresPasswordChange: true,
    });

    // Ajouter le teacher dans le document School (nécessaire pour que findByTeacher fonctionne)
    await School.updateOne(
      { _id: new mongoose.Types.ObjectId(SCHOOL_ID) },
      { $addToSet: { teachers: newUser._id } }
    );

    results.created++;
    console.log("✅ créé + lié à l'école");
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`✅ Créés    : ${results.created}`);
  console.log(`⚠️  Ignorés : ${results.skipped}`);
  console.log("═══════════════════════════════════════════════════");
  console.log(`\n📢 Dites aux enseignants :`);
  console.log(`   "Connectez-vous sur Xkorienta avec votre email`);
  console.log(`    et n'importe quel mot de passe."`);
  console.log(`   → Ils seront automatiquement invités à définir`);
  console.log(`     leur propre mot de passe.\n`);

  if (!DRY_RUN) await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
