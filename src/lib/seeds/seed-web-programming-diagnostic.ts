/**
 * SEED: Diagnostic Flash - Introduction à la Programmation Web
 *
 * Ce script insère en base de données :
 *   - Un Subject "Programmation Web"
 *   - Un EducationLevel générique (Licence/L1)
 *   - Un User enseignant (si inexistant)
 *   - L'Exam (mini-test diagnostique)
 *   - 10 Questions couvrant : Internet, WWW, Architecture, HTML, CSS, JS
 *   - Les Options de chaque question
 *
 * Usage : npx ts-node -r tsconfig-paths/register src/lib/seeds/seed-web-programming-diagnostic.ts
 */

import * as dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

// Load .env from API root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ─── Helpers ────────────────────────────────────────────────────────────────

async function connectDB() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL not set in .env");
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");
  }
}

// ─── Data ────────────────────────────────────────────────────────────────────

const QUESTIONS_DATA = [
  // ── INTERNET & GÉNÉRALITÉS ────────────────────────────────────────────
  {
    text: "Qu'est-ce qu'Internet ?",
    explanation:
      "Internet est un réseau mondial de réseaux informatiques interconnectés, permettant l'échange de données via des protocoles standardisés comme TCP/IP.",
    difficulty: "BEGINNER",
    points: 1,
    order: 1,
    tags: ["internet", "réseau", "introduction"],
    options: [
      {
        text: "Un réseau mondial d'ordinateurs interconnectés via TCP/IP",
        isCorrect: true,
        explanation:
          "Correct ! Internet est bien un réseau de réseaux mondial basé sur TCP/IP.",
      },
      {
        text: "Un logiciel créé par Google pour naviguer sur le web",
        isCorrect: false,
        explanation: "Non. Google a créé Chrome (navigateur), pas Internet.",
      },
      {
        text: "Un service de messagerie électronique uniquement",
        isCorrect: false,
        explanation:
          "Non. L'e-mail est un service sur Internet, mais Internet est bien plus large.",
      },
      {
        text: "Intranet d'une entreprise accessible au public",
        isCorrect: false,
        explanation:
          "Non. Un intranet est un réseau privé. Internet est public et mondial.",
      },
    ],
  },
  {
    text: "Quelle est la différence entre Internet et le Web (WWW) ?",
    explanation:
      "Internet est l'infrastructure réseau physique (câbles, routeurs, protocoles). Le Web (WWW) est un service parmi d'autres s'appuyant sur Internet, utilisant HTTP/HTTPS pour accéder à des pages web.",
    difficulty: "BEGINNER",
    points: 1,
    order: 2,
    tags: ["internet", "www", "distinction"],
    options: [
      {
        text: "Ils sont identiques, c'est juste deux noms différents",
        isCorrect: false,
        explanation:
          "Non, ils sont différents : Internet est l'infrastructure, le Web est un service qui l'utilise.",
      },
      {
        text: "Internet est l'infrastructure réseau, le Web est un service qui l'utilise via HTTP",
        isCorrect: true,
        explanation:
          "Exact ! Internet = infrastructure physique + protocoles. WWW = service web basé sur HTTP/HTTPS.",
      },
      {
        text: "Le Web est plus ancien qu'Internet",
        isCorrect: false,
        explanation:
          "Non. Internet existe depuis les années 1960 (ARPANET). Le Web a été inventé en 1989 par Tim Berners-Lee.",
      },
      {
        text: "Internet est uniquement américain, le Web est mondial",
        isCorrect: false,
        explanation:
          "Non. Les deux sont mondiaux. Internet a émergé des États-Unis mais est international.",
      },
    ],
  },
  // ── ARCHITECTURE WEB ──────────────────────────────────────────────────
  {
    text: "Dans l'architecture Client-Serveur du Web, quel est le rôle du client ?",
    explanation:
      "Dans l'architecture client-serveur, le client (navigateur) envoie des requêtes HTTP au serveur et affiche les réponses. Le serveur traite les requêtes et renvoie les ressources (HTML, CSS, JS, images...).",
    difficulty: "BEGINNER",
    points: 1,
    order: 3,
    tags: ["architecture", "client-serveur", "http"],
    options: [
      {
        text: "Stocker et gérer les bases de données",
        isCorrect: false,
        explanation:
          "Non, c'est le rôle du serveur (ou du SGBD). Le client affiche uniquement.",
      },
      {
        text: "Envoyer des requêtes HTTP et afficher les réponses dans le navigateur",
        isCorrect: true,
        explanation:
          "Correct ! Le client (navigateur) envoie des requêtes et affiche ce que le serveur renvoie.",
      },
      {
        text: "Héberger les fichiers du site web",
        isCorrect: false,
        explanation:
          "Non. L'hébergement est fait côté serveur. Le client consomme les ressources.",
      },
      {
        text: "Gérer les connexions entre utilisateurs",
        isCorrect: false,
        explanation:
          "Non. La gestion des connexions est un rôle du serveur ou de services dédiés.",
      },
    ],
  },
  {
    text: "Qu'est-ce qu'un protocole HTTP ?",
    explanation:
      "HTTP (HyperText Transfer Protocol) est le protocole de communication qui définit comment les messages sont formatés et transmis entre clients et serveurs web. HTTPS est la version sécurisée (chiffrée).",
    difficulty: "INTERMEDIATE",
    points: 1,
    order: 4,
    tags: ["http", "protocole", "architecture"],
    options: [
      {
        text: "Un langage de programmation pour créer des sites web",
        isCorrect: false,
        explanation:
          "Non. HTTP n'est pas un langage de programmation. HTML, CSS et JS le sont.",
      },
      {
        text: "Un protocole de communication définissant les échanges entre client et serveur web",
        isCorrect: true,
        explanation:
          "Exactement ! HTTP définit le format des requêtes et réponses entre navigateur et serveur.",
      },
      {
        text: "Un logiciel pour créer des bases de données",
        isCorrect: false,
        explanation:
          "Non. Pour les bases de données on utilise MySQL, PostgreSQL, MongoDB, etc.",
      },
      {
        text: "Un système d'exploitation pour serveurs",
        isCorrect: false,
        explanation:
          "Non. Linux, Windows Server sont des OS serveur. HTTP est juste un protocole.",
      },
    ],
  },
  // ── HTML ──────────────────────────────────────────────────────────────
  {
    text: "Que signifie l'acronyme HTML ?",
    explanation:
      "HTML signifie HyperText Markup Language. C'est le langage de balisage standard pour créer des pages web. Il structure le contenu avec des balises comme <h1>, <p>, <a>, <img>, etc.",
    difficulty: "BEGINNER",
    points: 1,
    order: 5,
    tags: ["html", "balises", "structure"],
    options: [
      {
        text: "High Text Manipulation Language",
        isCorrect: false,
        explanation: "Non. Cette signification n'existe pas.",
      },
      {
        text: "HyperText Markup Language",
        isCorrect: true,
        explanation:
          "Exact ! HTML = HyperText Markup Language, le langage de balisage du web.",
      },
      {
        text: "Hyper Transfer Markup Logic",
        isCorrect: false,
        explanation: "Non. Cette signification est incorrecte.",
      },
      {
        text: "Hosted Text Modeling Language",
        isCorrect: false,
        explanation: "Non. Cette signification n'existe pas.",
      },
    ],
  },
  {
    text: "Quelle balise HTML est utilisée pour créer un lien hypertexte ?",
    explanation:
      'La balise <a> (ancre) est utilisée pour créer des liens hypertextes. L\'attribut href définit la destination. Exemple : <a href="https://exemple.com">Cliquez ici</a>',
    difficulty: "BEGINNER",
    points: 1,
    order: 6,
    tags: ["html", "balises", "liens"],
    options: [
      {
        text: "<link>",
        isCorrect: false,
        explanation:
          "Non. <link> est utilisé dans le <head> pour lier des ressources externes (CSS). Pas pour les liens cliquables.",
      },
      {
        text: "<href>",
        isCorrect: false,
        explanation:
          "Non. href est un attribut de la balise <a>, ce n'est pas une balise.",
      },
      {
        text: "<a>",
        isCorrect: true,
        explanation:
          "Correct ! La balise <a> (anchor) avec l'attribut href crée les liens hypertextes.",
      },
      {
        text: "<url>",
        isCorrect: false,
        explanation: "Non. <url> n'est pas une balise HTML valide.",
      },
    ],
  },
  // ── CSS ───────────────────────────────────────────────────────────────
  {
    text: "Quel est le rôle du CSS dans une page web ?",
    explanation:
      "CSS (Cascading Style Sheets) est le langage utilisé pour styliser les pages HTML : couleurs, typographie, mise en page, animations, responsive design. Il sépare la forme (CSS) du fond (HTML).",
    difficulty: "BEGINNER",
    points: 1,
    order: 7,
    tags: ["css", "style", "design"],
    options: [
      {
        text: "Structurer le contenu de la page (titres, paragraphes, images)",
        isCorrect: false,
        explanation: "Non. La structure du contenu est le rôle du HTML.",
      },
      {
        text: "Définir l'apparence visuelle de la page (couleurs, typographie, mise en page)",
        isCorrect: true,
        explanation:
          "Exact ! CSS s'occupe du style : couleurs, polices, espacements, disposition des éléments.",
      },
      {
        text: "Gérer les interactions et la logique de la page",
        isCorrect: false,
        explanation:
          "Non. Les interactions et la logique sont gérées par JavaScript.",
      },
      {
        text: "Communiquer avec la base de données",
        isCorrect: false,
        explanation:
          "Non. La communication avec la BDD est gérée côté serveur (PHP, Node.js, etc.).",
      },
    ],
  },
  {
    text: "Qu'est-ce qu'un sélecteur CSS de classe ?",
    explanation:
      'Un sélecteur de classe CSS cible tous les éléments ayant cet attribut class. Il s\'écrit avec un point (.) suivi du nom de classe. Exemple : .bouton { color: blue; } cible tous les éléments avec class="bouton".',
    difficulty: "INTERMEDIATE",
    points: 2,
    order: 8,
    tags: ["css", "sélecteurs", "classe"],
    options: [
      {
        text: "Un sélecteur qui commence par # et cible un élément unique par son ID",
        isCorrect: false,
        explanation:
          "Non. Le # est le sélecteur d'ID, pas de classe. La classe commence par un point (.).",
      },
      {
        text: "Un sélecteur qui commence par . (point) et cible les éléments partageant ce nom de classe",
        isCorrect: true,
        explanation:
          'Correct ! .maClasse { } cible tous les éléments ayant class="maClasse" dans le HTML.',
      },
      {
        text: "Un sélecteur qui cible tous les éléments d'un certain type (ex: p, h1)",
        isCorrect: false,
        explanation: "Non. Ça c'est un sélecteur de type ou d'élément.",
      },
      {
        text: "Un sélecteur qui cible les éléments selon leur position dans la page",
        isCorrect: false,
        explanation:
          "Non. Les pseudo-classes comme :nth-child() font ça. La classe est un attribut html.",
      },
    ],
  },
  // ── JAVASCRIPT ────────────────────────────────────────────────────────
  {
    text: "Quel est le rôle de JavaScript dans le développement web ?",
    explanation:
      "JavaScript est le langage de programmation du web côté client. Il permet de rendre les pages web interactives : réponse aux clics, validation de formulaires, animations, appels serveur asynchrones (AJAX/fetch), manipulation du DOM.",
    difficulty: "BEGINNER",
    points: 1,
    order: 9,
    tags: ["javascript", "interactivité", "frontend"],
    options: [
      {
        text: "Définir la structure des pages web avec des balises",
        isCorrect: false,
        explanation: "Non. La structure est définie par HTML, pas JavaScript.",
      },
      {
        text: "Styliser visuellement la page (couleurs, fonts, mise en page)",
        isCorrect: false,
        explanation: "Non. Le style est le rôle de CSS.",
      },
      {
        text: "Rendre les pages web interactives et dynamiques côté navigateur",
        isCorrect: true,
        explanation:
          "Exactement ! JS gère les interactions, animations, requêtes asynchrones et manipulation du DOM.",
      },
      {
        text: "Gérer le serveur d'hébergement web",
        isCorrect: false,
        explanation:
          "Non. La gestion de serveur se fait généralement avec Node.js, PHP, Python, etc. côté serveur.",
      },
    ],
  },
  {
    text: "Parmi les propositions suivantes, laquelle représente une déclaration de variable correcte en JavaScript moderne ?",
    explanation:
      "En JavaScript moderne (ES6+), on utilise 'let' pour les variables réassignables et 'const' pour les constantes. 'var' est l'ancienne syntaxe, déconseillée. 'variable' seul n'est pas un mot-clé JS.",
    difficulty: "INTERMEDIATE",
    points: 2,
    order: 10,
    tags: ["javascript", "variables", "es6", "syntaxe"],
    options: [
      {
        text: 'variable nom = "Alice"',
        isCorrect: false,
        explanation:
          "Non. 'variable' n'est pas un mot-clé JavaScript. On utilise let, const ou var.",
      },
      {
        text: 'int nom = "Alice"',
        isCorrect: false,
        explanation:
          "Non. 'int' est utilisé dans des langages comme Java ou C. JavaScript est dynamiquement typé.",
      },
      {
        text: 'let nom = "Alice"',
        isCorrect: true,
        explanation:
          "Correct ! 'let' est la syntaxe moderne ES6+ pour déclarer une variable réassignable.",
      },
      {
        text: 'string nom = "Alice"',
        isCorrect: false,
        explanation:
          "Non. JavaScript n'a pas de mots-clés de type comme 'string'. Le type est inféré dynamiquement.",
      },
    ],
  },
];

// ─── Main Seed ───────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();

  // Import models dynamically
  const { default: Subject } = await import("../../models/Subject");
  const { default: EducationLevel } =
    await import("../../models/EducationLevel");
  const { default: User } = await import("../../models/User");
  const { default: Exam } = await import("../../models/Exam");
  const { default: Question } = await import("../../models/Question");
  const { default: Option } = await import("../../models/Option");

  console.log("\n🌱 Starting seed: Diagnostic Flash - Programmation Web\n");

  // ── 1. Subject ─────────────────────────────────────────────────────────
  let subject = await Subject.findOne({ code: "PROG-WEB-101" });
  if (!subject) {
    subject = await Subject.create({
      name: "Programmation Web",
      code: "PROG-WEB-101",
      subSystem: "FRANCOPHONE",
      applicableLevels: [],
      applicableFields: [],
      isTransversal: true,
      subjectType: "UE",
      isActive: true,
      metadata: {
        displayName: { fr: "Programmation Web", en: "Web Programming" },
        description:
          "Introduction à la programmation web : Internet, WWW, Architecture client-serveur, HTML, CSS, JavaScript",
        icon: "🌐",
        color: "#1e40af",
      },
    });
    console.log("✅ Subject créé:", subject.name);
  } else {
    console.log("ℹ️  Subject existant:", subject.name);
  }

  // ── 2. EducationLevel ──────────────────────────────────────────────────
  let educationLevel = await EducationLevel.findOne({ code: "LICENCE-L1-FR" });
  if (!educationLevel) {
    educationLevel = await EducationLevel.create({
      name: "Licence 1 (L1)",
      code: "LICENCE-L1-FR",
      cycle: "LICENCE",
      subSystem: "FRANCOPHONE",
      order: 7,
      isActive: true,
      metadata: {
        displayName: { fr: "Licence 1ère année", en: "Bachelor Year 1" },
        description: "Première année de licence universitaire",
      },
    });
    console.log("✅ EducationLevel créé:", educationLevel.name);
  } else {
    console.log("ℹ️  EducationLevel existant:", educationLevel.name);
  }

  // ── 3. Teacher User (système) ──────────────────────────────────────────
  let teacher = await User.findOne({ email: "system-teacher@Xkorienta.app" });
  if (!teacher) {
    teacher = await User.create({
      name: "Équipe xkorienta",
      email: "tagnewambo@m4moveralls.com",
      role: "TEACHER",
      subSystem: "FRANCOPHONE",
      isActive: true,
      emailVerified: true,
      preferences: {
        language: "fr",
        notifications: { email: false, push: false },
      },
      metadata: {},
      loginAttempts: 0,
    });
    console.log("✅ Teacher créé:", teacher.name);
  } else {
    console.log("ℹ️  Teacher existant:", teacher.name);
  }

  // ── 4. Exam ────────────────────────────────────────────────────────────
  // Check if already seeded
  const existingExam = await Exam.findOne({
    tags: "seed-prog-web-diagnostic-v1",
  });
  if (existingExam) {
    console.log(
      '⚠️  Le diagnostic flash "Programmation Web" existe déjà en base (ID:',
      existingExam._id,
      ")",
    );
    console.log("   Rien à faire. Exécutez avec --force pour réinitialiser.");
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const farFuture = new Date("2099-12-31T23:59:59Z");

  const exam = await Exam.create({
    title: "Diagnostic Flash – Introduction à la Programmation Web",
    description:
      "Évaluez votre niveau en programmation web ! 10 questions sur Internet, le WWW, l'architecture client-serveur, HTML, CSS et JavaScript. Résultat instantané avec votre profil détaillé.",
    subSystem: "FRANCOPHONE",
    targetLevels: [educationLevel._id],
    subject: subject._id,
    pedagogicalObjective: "DIAGNOSTIC_EVAL",
    evaluationType: "QCM",
    learningMode: "AUTO_EVAL",
    difficultyLevel: "BEGINNER",
    startTime: now,
    endTime: farFuture,
    duration: 10, // 10 minutes
    closeMode: "PERMISSIVE",
    status: "PUBLISHED",
    isPublished: true,
    isActive: true,
    isPublicDemo: true,
    publishedAt: now,
    config: {
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultsImmediately: true,
      allowReview: true,
      passingScore: 50,
      maxAttempts: 3,
      timeBetweenAttempts: 0,
      enableImmediateFeedback: true,
      antiCheat: {
        fullscreenRequired: false,
        disableCopyPaste: false,
        trackTabSwitches: false,
        webcamRequired: false,
        preventScreenshot: false,
        maxTabSwitches: 10,
        blockRightClick: false,
      },
    },
    stats: {
      totalAttempts: 0,
      totalCompletions: 0,
      averageScore: 0,
      averageTime: 0,
      passRate: 0,
    },
    createdById: teacher._id,
    tags: [
      "programmation-web",
      "diagnostic",
      "flash",
      "débutant",
      "html",
      "css",
      "javascript",
      "internet",
      "www",
      "seed-prog-web-diagnostic-v1",
    ],
  });
  console.log("\n✅ Exam créé:", exam.title);
  console.log("   ID:", exam._id);

  // ── 5. Questions & Options ─────────────────────────────────────────────
  let totalQuestions = 0;
  let totalOptions = 0;

  for (const qData of QUESTIONS_DATA) {
    const { options: optionsData, ...questionFields } = qData;

    const question = await Question.create({
      examId: exam._id,
      text: questionFields.text,
      type: "QCM",
      points: questionFields.points,
      difficulty: questionFields.difficulty as any,
      explanation: questionFields.explanation,
      tags: questionFields.tags,
      order: questionFields.order,
      stats: {
        timesAsked: 0,
        timesCorrect: 0,
        timesIncorrect: 0,
        successRate: 0,
      },
    });

    for (let i = 0; i < optionsData.length; i++) {
      await Option.create({
        questionId: question._id,
        text: optionsData[i].text,
        isCorrect: optionsData[i].isCorrect,
        explanation: optionsData[i].explanation,
        order: i,
        stats: { timesSelected: 0, selectionRate: 0 },
      });
      totalOptions++;
    }

    console.log(
      `   ✅ Q${questionFields.order}: ${questionFields.text.substring(0, 60)}...`,
    );
    totalQuestions++;
  }

  console.log("\n🎉 Seed terminé avec succès !");
  console.log(`   📝 ${totalQuestions} questions créées`);
  console.log(`   🔘 ${totalOptions} options créées`);
  console.log(`\n   🔗 Accédez au test : /mini-test`);
  console.log(`   📋 ID de l'exam : ${exam._id}\n`);

  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
}

// Run
seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
