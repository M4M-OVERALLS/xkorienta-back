#!/usr/bin/env node

/**
 * Bulk import books from a local folder into the platform.
 *
 * Usage:
 *   node scripts/bulk-import-books.js
 *
 * What it does:
 *  1. Scans the source folder for PDF files (DOCX excluded — platform supports PDF/EPUB only)
 *  2. Deduplicates by file size
 *  3. Classifies by theme using filename analysis
 *  4. Copies each file to private/books/ with a safe key
 *  5. Creates Book documents in MongoDB (status: APPROVED, price: 0, scope: GLOBAL)
 *
 * Edit the CONFIG section below before running.
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

// ═══════════════════════════════════════════════
// CONFIG — edit these before running
// ═══════════════════════════════════════════════

const SOURCE_DIR = path.resolve(__dirname, "../../Article Professeur Lemana");

// Professor Lemana's user email — used to look up his _id in the DB
const TEACHER_EMAIL = "sergelemanaonana@gmail.com";

const DEFAULT_PRICE = 0; // Free for now
const DEFAULT_CURRENCY = "XAF";
const DEFAULT_SCOPE = "GLOBAL";
const DEFAULT_STATUS = "APPROVED";

// Files to skip entirely (administrative / CV / duplicates)
const SKIP_PATTERNS = [
  /publications du pr/i,
  /mémoires encadrés/i,
  /fichier 2.*actes administratifs/i,
  /docscanner/i,
  /couverture onana/i,
  /file\.pdf\.pdf/i,
  /202502041441/i,
];

// Theme classification rules (order matters — first match wins)
const THEME_RULES = [
  {
    pattern: /problematique/i,
    theme: "Problématique philosophique",
    descPrefix: "Ouvrage de la série « Problématique » du Pr Lemana Onana.",
  },
  {
    pattern: /decolonialisme|neocolonial/i,
    theme: "Décolonialisme & Pensée politique",
    descPrefix:
      "Réflexion sur le décolonialisme idéologique et le néo-colonialisme.",
  },
  {
    pattern: /bellicisme|urphissa|tpc/i,
    theme: "Études africaines — Conflits & Paix",
    descPrefix: "Cahiers de l'URPHISSA — analyse du bellicisme en Afrique.",
  },
  {
    pattern: /damn[ée].*afrique|damnr/i,
    theme: "Philosophie africaine",
    descPrefix: "Essai sur la condition africaine et ses perspectives.",
  },
  {
    pattern: /antinomie|auto-affirmation|philosophie africaine/i,
    theme: "Philosophie africaine",
    descPrefix: "Réflexion sur l'auto-affirmation de la philosophie africaine.",
  },
  {
    pattern: /femme.*machiavel/i,
    theme: "Philosophie politique & Genre",
    descPrefix: "Analyse philosophique de la figure machiavélique féminine.",
  },
  {
    pattern: /marcel.*towa/i,
    theme: "Philosophie africaine",
    descPrefix: "Étude sur la pensée de Marcel Towa.",
  },
  {
    pattern: /carte scolaire/i,
    theme: "Politique éducative",
    descPrefix: "Article sur la carte scolaire et la planification éducative.",
  },
  {
    pattern: /bitang|mbam|peuple/i,
    theme: "Anthropologie & Culture",
    descPrefix: "Étude ethnographique sur le peuple Bitang du Mbam.",
  },
  {
    pattern: /methodolog/i,
    theme: "Méthodologie philosophique",
    descPrefix: "Guide méthodologique pour l'enseignement de la philosophie.",
  },
  {
    pattern: /preambule.*della/i,
    theme: "Revue DELLA",
    descPrefix: "Revue DELLA — numéro spécial, préambule éditorial.",
  },
  {
    pattern: /these/i,
    theme: "Travaux académiques",
    descPrefix: "Thèse de doctorat du Pr Lemana Onana.",
  },
  {
    pattern: /9782140/i,
    theme: "Publications L'Harmattan",
    descPrefix: "Ouvrage publié aux éditions L'Harmattan.",
  },
];

const DEFAULT_THEME = "Philosophie — Travaux du Pr Lemana";
const DEFAULT_DESC_PREFIX = "Publication académique du Pr Serge Lemana Onana.";

// ═══════════════════════════════════════════════

const BOOKS_DIR = path.join(process.cwd(), "private", "books");

function shouldSkip(filename) {
  return SKIP_PATTERNS.some((p) => p.test(filename));
}

function classifyFile(filename) {
  for (const rule of THEME_RULES) {
    if (rule.pattern.test(filename)) {
      return { theme: rule.theme, descPrefix: rule.descPrefix };
    }
  }
  return { theme: DEFAULT_THEME, descPrefix: DEFAULT_DESC_PREFIX };
}

function cleanTitle(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/^\d+\s*/, "") // leading numbers
    .replace(/\s+/g, " ") // multiple spaces
    .replace(/\s*\d+$/, "") // trailing number (dupes like "Lemana 2")
    .trim();
}

function safeFileKey(filename) {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  const base = path
    .basename(filename, path.extname(filename))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);
  return `${base}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
}

function formatFromExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "PDF";
  if (ext === ".epub") return "EPUB";
  return null;
}

async function main() {
  // Connect to MongoDB
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    process.exit(1);
  }
  await mongoose.connect(dbUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
  });

  const User =
    mongoose.models.User ||
    mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const Book =
    mongoose.models.Book ||
    mongoose.model("Book", new mongoose.Schema({}, { strict: false }));

  // Find teacher
  const teacher = await User.findOne({ email: TEACHER_EMAIL }).lean();
  if (!teacher) {
    const teachers = await User.find(
      { role: { $in: ["TEACHER", "DG_M4M"] } },
      { email: 1, name: 1 },
    )
      .limit(10)
      .lean();
    teachers.forEach((t) =>
    process.exit(1);
  }

  // Scan source directory
  const allFiles = await fsp.readdir(SOURCE_DIR);

  // Filter: only PDF (platform doesn't support DOCX)
  const pdfFiles = allFiles.filter((f) => formatFromExt(f) !== null);
  const docxFiles = allFiles.filter(
    (f) => path.extname(f).toLowerCase() === ".docx",
  );

  // Skip administrative files
  const candidates = pdfFiles.filter((f) => !shouldSkip(f));
  const skipped = pdfFiles.filter((f) => shouldSkip(f));
  if (skipped.length > 0) {
    skipped.forEach((f) =>
  }

  // Deduplicate by file size
  const sizeMap = new Map();
  const unique = [];
  for (const filename of candidates) {
    const filePath = path.join(SOURCE_DIR, filename);
    const stat = await fsp.stat(filePath);
    const key = `${stat.size}`;
    if (sizeMap.has(key)) {
    } else {
      sizeMap.set(key, filename);
      unique.push(filename);
    }
  }

  // Ensure books directory exists
  await fsp.mkdir(BOOKS_DIR, { recursive: true });

  // Group by theme and import
  const byTheme = {};
  const results = [];

  for (const filename of unique) {
    const { theme, descPrefix } = classifyFile(filename);
    if (!byTheme[theme]) byTheme[theme] = [];

    const title = cleanTitle(filename);
    const fileKey = safeFileKey(filename);
    const srcPath = path.join(SOURCE_DIR, filename);
    const destPath = path.join(BOOKS_DIR, fileKey);
    const format = formatFromExt(filename);
    const stat = await fsp.stat(srcPath);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);

    // Check if already imported (by title + submittedBy)
    const existing = await Book.findOne({
      title: {
        $regex: new RegExp(
          `^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 40)}`,
          "i",
        ),
      },
      submittedBy: teacher._id,
    });
    if (existing) {
      byTheme[theme].push({ title, status: "already_exists" });
      continue;
    }

    // Copy file
    await fsp.copyFile(srcPath, destPath);

    const description = `${descPrefix}\n\nAuteur : Pr Serge Lemana Onana\nThème : ${theme}\nFormat : ${format} (${sizeMB} Mo)`;

    // Insert into DB
    const doc = await Book.create({
      title,
      description,
      format,
      fileKey,
      price: DEFAULT_PRICE,
      currency: DEFAULT_CURRENCY,
      scope: DEFAULT_SCOPE,
      submittedBy: teacher._id,
      status: DEFAULT_STATUS,
      validatedBy: teacher._id,
      validatedAt: new Date(),
      copyrightAccepted: true,
      downloadCount: 0,
      purchaseCount: 0,
    });

    byTheme[theme].push({ title, id: doc._id.toString(), status: "imported" });
    results.push({ title, id: doc._id.toString(), theme, fileKey });
  }

  // Summary
  for (const [theme, books] of Object.entries(byTheme)) {
    const imported = books.filter((b) => b.status === "imported");
    const existing = books.filter((b) => b.status === "already_exists");
    books.forEach((b) => {
      const icon = b.status === "imported" ? "✓" : "⏭";
    });
  }

  if (docxFiles.length > 0) {
    docxFiles.forEach((f) =>
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  process.exit(1);
});
