#!/usr/bin/env node

/**
 * Seed script: Default subscription plans
 *
 * Creates the default plans for the Xkorienta platform:
 * - FREEMIUM: Free plan with limited features
 * - PREMIUM_MONTHLY: Monthly premium subscription
 * - PREMIUM_YEARLY: Yearly premium subscription (with discount)
 *
 * Usage:
 *   node scripts/seed-plans.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const SubscriptionInterval = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
};

const Currency = {
  XAF: "XAF",
  EUR: "EUR",
  USD: "USD",
};

const DEFAULT_PLANS = [
  {
    code: "FREEMIUM",
    name: "Gratuit",
    description:
      "Accès de base à la plateforme Xkorienta. Parfait pour découvrir nos services.",
    prices: [],
    features: [
      "Accès aux cours gratuits",
      "Auto-évaluation limitée (5/mois)",
      "2 classes maximum",
      "Forum communautaire",
      "Statistiques de base",
    ],
    limits: {
      maxExamsPerMonth: 5,
      maxClassesJoined: 2,
      downloadBooks: false,
      prioritySupport: false,
      aiAssistance: false,
      offlineAccess: false,
    },
    isActive: true,
    sortOrder: 0,
    isFree: true,
  },
  {
    code: "PREMIUM_MONTHLY",
    name: "Premium Mensuel",
    description:
      "Abonnement mensuel avec accès complet à toutes les fonctionnalités premium.",
    prices: [
      {
        currency: Currency.XAF,
        amount: 5000,
        interval: SubscriptionInterval.MONTHLY,
      },
      {
        currency: Currency.EUR,
        amount: 8,
        interval: SubscriptionInterval.MONTHLY,
      },
      {
        currency: Currency.USD,
        amount: 9,
        interval: SubscriptionInterval.MONTHLY,
      },
    ],
    features: [
      "Tous les avantages Gratuit",
      "Auto-évaluations illimitées",
      "Classes illimitées",
      "Téléchargement de livres",
      "Assistance IA personnalisée",
      "Statistiques avancées",
      "Mode hors-ligne",
      "Pas de publicités",
    ],
    limits: {
      maxExamsPerMonth: null, // unlimited
      maxClassesJoined: null, // unlimited
      downloadBooks: true,
      prioritySupport: false,
      aiAssistance: true,
      offlineAccess: true,
    },
    isActive: true,
    sortOrder: 1,
    isFree: false,
  },
  {
    code: "PREMIUM_YEARLY",
    name: "Premium Annuel",
    description:
      "Abonnement annuel avec 2 mois gratuits. Le meilleur rapport qualité-prix!",
    prices: [
      {
        currency: Currency.XAF,
        amount: 50000,
        interval: SubscriptionInterval.YEARLY,
      }, // 2 mois gratuits
      {
        currency: Currency.EUR,
        amount: 80,
        interval: SubscriptionInterval.YEARLY,
      },
      {
        currency: Currency.USD,
        amount: 90,
        interval: SubscriptionInterval.YEARLY,
      },
    ],
    features: [
      "Tous les avantages Premium Mensuel",
      "2 mois gratuits (économisez 17%)",
      "Support prioritaire",
      "Accès anticipé aux nouvelles fonctionnalités",
      "Certificats de complétion",
      "Badge Premium exclusif",
    ],
    limits: {
      maxExamsPerMonth: null, // unlimited
      maxClassesJoined: null, // unlimited
      downloadBooks: true,
      prioritySupport: true,
      aiAssistance: true,
      offlineAccess: true,
    },
    isActive: true,
    sortOrder: 2,
    isFree: false,
  },
  {
    code: "INSTITUTION",
    name: "Institution",
    description:
      "Forfait pour les écoles et établissements. Contactez-nous pour un devis personnalisé.",
    prices: [
      {
        currency: Currency.XAF,
        amount: 500000,
        interval: SubscriptionInterval.YEARLY,
      },
      {
        currency: Currency.EUR,
        amount: 800,
        interval: SubscriptionInterval.YEARLY,
      },
      {
        currency: Currency.USD,
        amount: 900,
        interval: SubscriptionInterval.YEARLY,
      },
    ],
    features: [
      "Tous les avantages Premium",
      "Jusqu'à 500 utilisateurs",
      "Dashboard administrateur",
      "Rapports personnalisés",
      "Intégration API",
      "Support dédié",
      "Formation incluse",
    ],
    limits: {
      maxExamsPerMonth: null,
      maxClassesJoined: null,
      downloadBooks: true,
      prioritySupport: true,
      aiAssistance: true,
      offlineAccess: true,
    },
    isActive: true,
    sortOrder: 3,
    isFree: false,
  },
];

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not defined in environment");
  }
  await mongoose.connect(uri);
}

async function seedPlans() {
  const db = mongoose.connection.db;
  const plansCollection = db.collection("plans");

  for (const planData of DEFAULT_PLANS) {
    const existing = await plansCollection.findOne({ code: planData.code });

    if (existing) {
      // Update existing plan
      await plansCollection.updateOne(
        { code: planData.code },
        {
          $set: {
            ...planData,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      // Create new plan
      await plansCollection.insertOne({
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Display summary
  const totalPlans = await plansCollection.countDocuments();
  const activePlans = await plansCollection.countDocuments({ isActive: true });
}

async function main() {

  try {
    await connectDB();
    await seedPlans();
  } catch (err) {
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
