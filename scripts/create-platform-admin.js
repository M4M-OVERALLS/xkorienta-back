/**
 * Creates (or promotes) a platform administrator (DG_M4M by default, or TECH_SUPPORT).
 *
 * Platform admins peuvent :
 *   - Valider/rejeter N'IMPORTE QUEL livre (GLOBAL ou SCHOOL, toutes écoles)
 *   - Voir la file d'attente complète de validation
 *   - Gérer la configuration globale (config livres, écoles, etc.)
 *
 * Usage :
 *   node scripts/create-platform-admin.js \
 *     --email admin@xkorienta.cm \
 *     --name "Admin Plateforme" \
 *     --password "MonMotDePasseSolide!2024" \
 *     [--phone "+237600000000"] \
 *     [--role DG_M4M| TECH_SUPPORT]
 *
 * Si l'utilisateur existe déjà (email), le script le PROMEUT au rôle demandé
 * (sans toucher au mot de passe).
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const DATABASE_URL =
  process.env.DATABASE_URL || "mongodb://localhost:27017/xkorienta";
const ALLOWED_ROLES = ["DG_M4M", "TECH_SUPPORT"];

function parseArgs() {
  const args = { role: "DG_M4M" };
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    const value = process.argv[i + 1];
    if (key === "--email") {
      args.email = value;
      i++;
    }
    if (key === "--name") {
      args.name = value;
      i++;
    }
    if (key === "--password") {
      args.password = value;
      i++;
    }
    if (key === "--phone") {
      args.phone = value;
      i++;
    }
    if (key === "--role") {
      args.role = value;
      i++;
    }
  }
  return args;
}

function validate(args) {
  const errors = [];
  if (!args.email) errors.push("--email est requis");
  if (!args.name) errors.push("--name est requis");
  if (!args.password)
    errors.push("--password est requis (au moins 8 caractères)");
  if (args.password && args.password.length < 8)
    errors.push("--password doit faire au moins 8 caractères");
  if (!ALLOWED_ROLES.includes(args.role)) {
    errors.push(`--role doit être l'un de : ${ALLOWED_ROLES.join(", ")}`);
  }
  return errors;
}

async function run() {
  const args = parseArgs();
  const errors = validate(args);
  if (errors.length) {
    console.error("❌ Arguments invalides :");
    errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }

  console.log("🔌 Connexion à MongoDB...");
  await mongoose.connect(DATABASE_URL);
  console.log("✅ Connecté");

  const User = mongoose.model(
    "User",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "users",
  );

  const existing = await User.findOne({ email: args.email.toLowerCase() });

  if (existing) {
    console.log(
      `⚠️  Un utilisateur existe déjà avec ${args.email} (role actuel = ${existing.role || "none"})`,
    );
    console.log(`   → Promotion vers ${args.role}...`);
    existing.role = args.role;
    existing.isActive = true;
    if (args.phone) existing.phone = args.phone;
    await existing.save();
    console.log(`✅ Utilisateur promu en ${args.role}`);
    console.log(`   id     = ${existing._id}`);
    console.log(`   email  = ${existing.email}`);
    console.log(`   role   = ${existing.role}`);
    await mongoose.connection.close();
    process.exit(0);
  }

  const hashed = await bcrypt.hash(args.password, 12);
  const created = await User.create({
    name: args.name,
    email: args.email.toLowerCase(),
    phone: args.phone,
    password: hashed,
    role: args.role,
    isActive: true,
    emailVerified: true,
    loginAttempts: 0,
    preferences: {
      language: "fr",
      notifications: { email: true, push: true },
    },
    metadata: {},
  });

  console.log(`✅ Admin plateforme créé (${args.role}) :`);
  console.log(`   id     = ${created._id}`);
  console.log(`   name   = ${created.name}`);
  console.log(`   email  = ${created.email}`);
  console.log(`   role   = ${created.role}`);
  console.log(
    "\n🔐 Tu peux maintenant te connecter via /api/auth/callback/credentials",
  );
  console.log(
    "   avec identifier = " + created.email + " et le mot de passe choisi.",
  );

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
