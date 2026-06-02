#!/usr/bin/env node
/**
 * Activation manuelle d'un abonnement pour tests en développement.
 * Usage : node scripts/activate-subscription.js <email> [planCode]
 * Exemple : node scripts/activate-subscription.js user@test.com ELEVE
 */

require("dotenv").config();
const mongoose = require("mongoose");

const EMAIL = process.argv[2];
const PLAN_CODE = (process.argv[3] || "ELEVE").toUpperCase();

if (!EMAIL) {
  console.error("Usage: node scripts/activate-subscription.js <email> [planCode]");
  process.exit(1);
}

async function main() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Trouver l'utilisateur
  const user = await db.collection("users").findOne(
    { $or: [{ email: EMAIL }, { phone: EMAIL }] },
    { projection: { _id: 1, email: 1, name: 1 } }
  );
  if (!user) { process.stderr.write(`Utilisateur introuvable : ${EMAIL}\n`); process.exit(1); }

  // 2. Trouver le plan
  const plan = await db.collection("plans").findOne(
    { code: PLAN_CODE },
    { projection: { _id: 1, code: 1, name: 1, features: 1 } }
  );
  if (!plan) { process.stderr.write(`Plan introuvable : ${PLAN_CODE}\n`); process.exit(1); }

  // 3. Vérifier s'il y a déjà un abonnement actif
  const existing = await db.collection("subscriptions").findOne({
    userId: user._id,
    status: "ACTIVE",
  });
  if (existing) {
    console.log("Abonnement actif déjà existant :", existing._id.toString());
    await mongoose.disconnect();
    return;
  }

  // 4. Créer l'abonnement actif
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  const result = await db.collection("subscriptions").insertOne({
    userId: user._id,
    planId: plan._id,
    status: "ACTIVE",
    interval: "MONTHLY",
    currentPeriodStart: now,
    currentPeriodEnd: end,
    currency: "XAF",
    amount: 5000,
    autoRenew: true,
    renewalReminders: [],
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ Abonnement activé : ${result.insertedId}`);
  console.log(`   Plan    : ${plan.name}`);
  console.log(`   Expire  : ${end.toLocaleDateString()}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
