/**
 * Recrée un utilisateur supprimé avec son _id original.
 * Préserve toutes les relations (learnerprofiles, notifications, attempts...).
 *
 * Usage :
 *   node scripts/restore-user.js \
 *     --id 699866d3127c545f80d45a73 \
 *     --email juniortagne2001@gmail.com \
 *     --name "ELOHIM Junior TAGNE WAMBO" \
 *     --role TEACHER \
 *     --password "ChangeMe2025!" \
 *     [--schools "6932d5e2daa16626073519e5,698ae7e8dbd83ff31e2b2638"] \
 *     [--image "https://..."]
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL manquant dans .env");
  process.exit(1);
}

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) {
      const key = process.argv[i].slice(2);
      args[key] = process.argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  const { id, email, name, role, password, schools, image } = args;

  if (!id || !email || !name || !role || !password) {
    console.error("❌ Paramètres requis : --id --email --name --role --password");
    console.error("   Optionnels       : --schools (virgule-séparé) --image");
    process.exit(1);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.error("❌ --id invalide :", id);
    process.exit(1);
  }

  await mongoose.connect(DATABASE_URL);
  console.log("✅ Connecté à MongoDB");

  const User = mongoose.model(
    "User",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "users"
  );

  const existing = await User.findById(id);
  if (existing) {
    console.log(`⚠️  User ${id} existe déjà (${existing.email}). Rien à faire.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const emailExists = await User.findOne({ email });
  if (emailExists) {
    console.error(`❌ Email ${email} déjà utilisé par un autre user (${emailExists._id})`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const schoolIds = schools
    ? schools.split(",").map((s) => new mongoose.Types.ObjectId(s.trim()))
    : [];

  await User.create({
    _id: new mongoose.Types.ObjectId(id),
    name,
    email,
    role,
    password: hash,
    image: image || undefined,
    schools: schoolIds,
    isActive: true,
    tokenVersion: 0,
    loginAttempts: 0,
  });

  console.log("✅ User restauré avec succès !");
  console.log("   ID    :", id);
  console.log("   Email :", email);
  console.log("   Nom   :", name);
  console.log("   Rôle  :", role);
  console.log("   ⚠️  Mot de passe temporaire :", password);
  console.log("      → Changez-le dès la première connexion.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message);
  process.exit(1);
});
