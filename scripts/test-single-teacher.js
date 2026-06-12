/**
 * Script de test — crée UN SEUL enseignant pour vérifier le flux.
 * Usage : node scripts/test-single-teacher.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;
const SCHOOL_ID = "6932d5e2daa16626073519e5";

const TEST_TEACHER = { name: "Elohim (TEST)", email: "wamboelohim@gmail.com" };

async function main() {
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant");
    process.exit(1);
  }

  await mongoose.connect(DATABASE_URL);
  console.log("✅ Connecté à MongoDB\n");

  const User = mongoose.model(
    "User",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "users"
  );

  const School = mongoose.model(
    "School",
    new mongoose.Schema({}, { strict: false }),
    "schools"
  );

  const email = TEST_TEACHER.email.toLowerCase().trim();
  console.log(`→ Test avec : ${TEST_TEACHER.name} <${email}>`);

  const existing = await User.findOne({ email });
  if (existing) {
    // Retirer de l'école aussi
    await School.updateOne(
      { _id: new mongoose.Types.ObjectId(SCHOOL_ID) },
      { $pull: { teachers: existing._id } }
    );
    await User.deleteOne({ email });
    console.log("  🗑️  Ancien compte test supprimé");
  }

  const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

  const newUser = await User.create({
    name: TEST_TEACHER.name,
    email,
    role: "TEACHER",
    password: placeholderHash,
    schools: [new mongoose.Types.ObjectId(SCHOOL_ID)],
    isActive: true,
    tokenVersion: 0,
    loginAttempts: 0,
    requiresPasswordChange: true,
  });

  await School.updateOne(
    { _id: new mongoose.Types.ObjectId(SCHOOL_ID) },
    { $addToSet: { teachers: newUser._id } }
  );

  console.log("  ✅ Compte créé + lié à l'école");

  console.log("\n══════════════════════════════════════");
  console.log("Pour tester :");
  console.log(`1. Va sur /login`);
  console.log(`2. Email : ${email}`);
  console.log("3. Mot de passe : n'importe quoi (ex: test)");
  console.log("4. → Redirigé vers /change-password");
  console.log("5. Définis un mot de passe → dashboard");
  console.log("══════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
