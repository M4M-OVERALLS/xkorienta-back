/**
 * SEED: Diagnostic Flash – Introduction à la Programmation Web
 *
 * Ce script insère le diagnostic flash complet en base MongoDB :
 *   - Subject "Programmation Web"
 *   - EducationLevel (Licence L1)
 *   - User enseignant système (si inexistant)
 *   - Exam (mini-test, public, diagnostique)
 *   - 10 Questions + 40 Options
 *
 * Usage :
 *   npm run seed:web-diagnostic
 *   ou directement :
 *   node scripts/seed-web-programming-diagnostic.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error("❌ DATABASE_URL non défini dans .env");
  process.exit(1);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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
        order: 0,
      },
      {
        text: "Un logiciel créé par Google pour naviguer sur le web",
        isCorrect: false,
        explanation: "Non. Google a créé Chrome (navigateur), pas Internet.",
        order: 1,
      },
      {
        text: "Un service de messagerie électronique uniquement",
        isCorrect: false,
        explanation:
          "Non. L'e-mail est un service sur Internet, mais Internet est bien plus large.",
        order: 2,
      },
      {
        text: "Intranet d'une entreprise accessible au public",
        isCorrect: false,
        explanation:
          "Non. Un intranet est un réseau privé. Internet est public et mondial.",
        order: 3,
      },
    ],
  },
  {
    text: "Quelle est la différence entre Internet et le Web (WWW) ?",
    explanation:
      "Internet est l'infrastructure réseau physique. Le Web (WWW) est un service parmi d'autres s'appuyant sur Internet, utilisant HTTP/HTTPS pour accéder à des pages web.",
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
        order: 0,
      },
      {
        text: "Internet est l'infrastructure réseau, le Web est un service qui l'utilise via HTTP",
        isCorrect: true,
        explanation:
          "Exact ! Internet = infrastructure physique + protocoles. WWW = service web basé sur HTTP/HTTPS.",
        order: 1,
      },
      {
        text: "Le Web est plus ancien qu'Internet",
        isCorrect: false,
        explanation:
          "Non. Internet existe depuis les années 1960 (ARPANET). Le Web a été inventé en 1989 par Tim Berners-Lee.",
        order: 2,
      },
      {
        text: "Internet est uniquement américain, le Web est mondial",
        isCorrect: false,
        explanation: "Non. Les deux sont mondiaux.",
        order: 3,
      },
    ],
  },
  // ── ARCHITECTURE WEB ──────────────────────────────────────────────────
  {
    text: "Dans l'architecture Client-Serveur du Web, quel est le rôle du client ?",
    explanation:
      "Dans l'architecture client-serveur, le client (navigateur) envoie des requêtes HTTP au serveur et affiche les réponses.",
    difficulty: "BEGINNER",
    points: 1,
    order: 3,
    tags: ["architecture", "client-serveur", "http"],
    options: [
      {
        text: "Stocker et gérer les bases de données",
        isCorrect: false,
        explanation: "Non, c'est le rôle du serveur (ou du SGBD).",
        order: 0,
      },
      {
        text: "Envoyer des requêtes HTTP et afficher les réponses dans le navigateur",
        isCorrect: true,
        explanation:
          "Correct ! Le client (navigateur) envoie des requêtes et affiche ce que le serveur renvoie.",
        order: 1,
      },
      {
        text: "Héberger les fichiers du site web",
        isCorrect: false,
        explanation: "Non. L'hébergement est fait côté serveur.",
        order: 2,
      },
      {
        text: "Gérer les connexions entre utilisateurs",
        isCorrect: false,
        explanation: "Non. C'est un rôle du serveur.",
        order: 3,
      },
    ],
  },
  {
    text: "Qu'est-ce qu'un protocole HTTP ?",
    explanation:
      "HTTP (HyperText Transfer Protocol) est le protocole de communication qui définit comment les messages sont formatés et transmis entre clients et serveurs web. HTTPS est la version sécurisée.",
    difficulty: "INTERMEDIATE",
    points: 1,
    order: 4,
    tags: ["http", "protocole", "architecture"],
    options: [
      {
        text: "Un langage de programmation pour créer des sites web",
        isCorrect: false,
        explanation: "Non. HTTP n'est pas un langage de programmation.",
        order: 0,
      },
      {
        text: "Un protocole de communication définissant les échanges entre client et serveur web",
        isCorrect: true,
        explanation:
          "Exactement ! HTTP définit le format des requêtes et réponses entre navigateur et serveur.",
        order: 1,
      },
      {
        text: "Un logiciel pour créer des bases de données",
        isCorrect: false,
        explanation:
          "Non. Pour les bases de données on utilise MySQL, PostgreSQL, MongoDB, etc.",
        order: 2,
      },
      {
        text: "Un système d'exploitation pour serveurs",
        isCorrect: false,
        explanation:
          "Non. Linux, Windows Server sont des OS serveur. HTTP est juste un protocole.",
        order: 3,
      },
    ],
  },
  // ── HTML ──────────────────────────────────────────────────────────────
  {
    text: "Que signifie l'acronyme HTML ?",
    explanation:
      "HTML signifie HyperText Markup Language. C'est le langage de balisage standard pour créer des pages web.",
    difficulty: "BEGINNER",
    points: 1,
    order: 5,
    tags: ["html", "balises", "structure"],
    options: [
      {
        text: "High Text Manipulation Language",
        isCorrect: false,
        explanation: "Non. Cette signification n'existe pas.",
        order: 0,
      },
      {
        text: "HyperText Markup Language",
        isCorrect: true,
        explanation:
          "Exact ! HTML = HyperText Markup Language, le langage de balisage du web.",
        order: 1,
      },
      {
        text: "Hyper Transfer Markup Logic",
        isCorrect: false,
        explanation: "Non. Cette signification est incorrecte.",
        order: 2,
      },
      {
        text: "Hosted Text Modeling Language",
        isCorrect: false,
        explanation: "Non. Cette signification n'existe pas.",
        order: 3,
      },
    ],
  },
  {
    text: "Quelle balise HTML est utilisée pour créer un lien hypertexte ?",
    explanation:
      "La balise <a> (ancre) est utilisée pour créer des liens hypertextes. L'attribut href définit la destination.",
    difficulty: "BEGINNER",
    points: 1,
    order: 6,
    tags: ["html", "balises", "liens"],
    options: [
      {
        text: "<link>",
        isCorrect: false,
        explanation:
          "Non. <link> est utilisé dans le <head> pour lier des ressources externes (CSS).",
        order: 0,
      },
      {
        text: "<href>",
        isCorrect: false,
        explanation:
          "Non. href est un attribut de la balise <a>, ce n'est pas une balise.",
        order: 1,
      },
      {
        text: "<a>",
        isCorrect: true,
        explanation:
          "Correct ! La balise <a> (anchor) avec l'attribut href crée les liens hypertextes.",
        order: 2,
      },
      {
        text: "<url>",
        isCorrect: false,
        explanation: "Non. <url> n'est pas une balise HTML valide.",
        order: 3,
      },
    ],
  },
  // ── CSS ───────────────────────────────────────────────────────────────
  {
    text: "Quel est le rôle du CSS dans une page web ?",
    explanation:
      "CSS (Cascading Style Sheets) est le langage utilisé pour styliser les pages HTML : couleurs, typographie, mise en page, animations, responsive design.",
    difficulty: "BEGINNER",
    points: 1,
    order: 7,
    tags: ["css", "style", "design"],
    options: [
      {
        text: "Structurer le contenu de la page (titres, paragraphes, images)",
        isCorrect: false,
        explanation: "Non. La structure du contenu est le rôle du HTML.",
        order: 0,
      },
      {
        text: "Définir l'apparence visuelle de la page (couleurs, typographie, mise en page)",
        isCorrect: true,
        explanation:
          "Exact ! CSS s'occupe du style : couleurs, polices, espacements, disposition des éléments.",
        order: 1,
      },
      {
        text: "Gérer les interactions et la logique de la page",
        isCorrect: false,
        explanation: "Non. Les interactions sont gérées par JavaScript.",
        order: 2,
      },
      {
        text: "Communiquer avec la base de données",
        isCorrect: false,
        explanation:
          "Non. La communication avec la BDD est gérée côté serveur.",
        order: 3,
      },
    ],
  },
  {
    text: "Qu'est-ce qu'un sélecteur CSS de classe ?",
    explanation:
      "Un sélecteur de classe CSS cible tous les éléments ayant cet attribut class. Il s'écrit avec un point (.) suivi du nom de classe.",
    difficulty: "INTERMEDIATE",
    points: 2,
    order: 8,
    tags: ["css", "sélecteurs", "classe"],
    options: [
      {
        text: "Un sélecteur qui commence par # et cible un élément unique par son ID",
        isCorrect: false,
        explanation:
          "Non. Le # est le sélecteur d'ID. La classe commence par un point (.).",
        order: 0,
      },
      {
        text: "Un sélecteur qui commence par . (point) et cible les éléments partageant ce nom de classe",
        isCorrect: true,
        explanation:
          'Correct ! .maClasse { } cible tous les éléments ayant class="maClasse" dans le HTML.',
        order: 1,
      },
      {
        text: "Un sélecteur qui cible tous les éléments d'un certain type (ex: p, h1)",
        isCorrect: false,
        explanation: "Non. Ça c'est un sélecteur de type.",
        order: 2,
      },
      {
        text: "Un sélecteur qui cible les éléments selon leur position dans la page",
        isCorrect: false,
        explanation: "Non. Les pseudo-classes comme :nth-child() font ça.",
        order: 3,
      },
    ],
  },
  // ── JAVASCRIPT ────────────────────────────────────────────────────────
  {
    text: "Quel est le rôle de JavaScript dans le développement web ?",
    explanation:
      "JavaScript est le langage de programmation du web côté client. Il permet de rendre les pages web interactives : réponse aux clics, validation de formulaires, animations, appels serveur asynchrones.",
    difficulty: "BEGINNER",
    points: 1,
    order: 9,
    tags: ["javascript", "interactivité", "frontend"],
    options: [
      {
        text: "Définir la structure des pages web avec des balises",
        isCorrect: false,
        explanation: "Non. La structure est définie par HTML.",
        order: 0,
      },
      {
        text: "Styliser visuellement la page (couleurs, fonts, mise en page)",
        isCorrect: false,
        explanation: "Non. Le style est le rôle de CSS.",
        order: 1,
      },
      {
        text: "Rendre les pages web interactives et dynamiques côté navigateur",
        isCorrect: true,
        explanation:
          "Exactement ! JS gère les interactions, animations, requêtes asynchrones et manipulation du DOM.",
        order: 2,
      },
      {
        text: "Gérer le serveur d'hébergement web",
        isCorrect: false,
        explanation:
          "Non. La gestion de serveur se fait avec Node.js, PHP, Python, etc. côté serveur.",
        order: 3,
      },
    ],
  },
  {
    text: "Parmi les propositions suivantes, laquelle représente une déclaration de variable correcte en JavaScript moderne ?",
    explanation:
      "En JavaScript moderne (ES6+), on utilise 'let' pour les variables réassignables et 'const' pour les constantes. 'var' est l'ancienne syntaxe, déconseillée.",
    difficulty: "INTERMEDIATE",
    points: 2,
    order: 10,
    tags: ["javascript", "variables", "es6", "syntaxe"],
    options: [
      {
        text: 'variable nom = "Alice"',
        isCorrect: false,
        explanation: "Non. 'variable' n'est pas un mot-clé JavaScript.",
        order: 0,
      },
      {
        text: 'int nom = "Alice"',
        isCorrect: false,
        explanation:
          "Non. 'int' est utilisé dans Java ou C. JavaScript est dynamiquement typé.",
        order: 1,
      },
      {
        text: 'let nom = "Alice"',
        isCorrect: true,
        explanation:
          "Correct ! 'let' est la syntaxe moderne ES6+ pour déclarer une variable réassignable.",
        order: 2,
      },
      {
        text: 'string nom = "Alice"',
        isCorrect: false,
        explanation:
          "Non. JavaScript n'a pas de mots-clés de type comme 'string'.",
        order: 3,
      },
    ],
  },
];

// ─── Schemas légers (strict: false pour flexibilité) ─────────────────────────

const UserSchema = new mongoose.Schema({}, { strict: false });
const SubjectSchema = new mongoose.Schema({}, { strict: false });
const EducationLevelSchema = new mongoose.Schema({}, { strict: false });
const ExamSchema = new mongoose.Schema({}, { strict: false });
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const OptionSchema = new mongoose.Schema({}, { strict: false });

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedWebProgrammingDiagnostic() {
  try {
    console.log("\n🔌 Connexion à MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connecté à MongoDB\n");

    // Get or create models
    const User = mongoose.models.User || mongoose.model("User", UserSchema);
    const Subject =
      mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
    const EducationLevel =
      mongoose.models.EducationLevel ||
      mongoose.model("EducationLevel", EducationLevelSchema);
    const Exam = mongoose.models.Exam || mongoose.model("Exam", ExamSchema);
    const Question =
      mongoose.models.Question || mongoose.model("Question", QuestionSchema);
    const Option =
      mongoose.models.Option || mongoose.model("Option", OptionSchema);

    // ── 1. Vérifier si déjà seedé ──────────────────────────────────────
    const existingExam = await Exam.findOne({
      tags: "seed-prog-web-diagnostic-v1",
    });
    if (existingExam) {
      console.log(
        '⚠️  Le diagnostic flash "Programmation Web" existe déjà en base.',
      );
      console.log("   ID:", existingExam._id);
      console.log("   Titre:", existingExam.title);
      console.log(
        "\n   Pour réinitialiser, supprimez d'abord l'exam existant et relancez.\n",
      );
      await mongoose.connection.close();
      return;
    }

    // ── 2. Subject ─────────────────────────────────────────────────────
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
      console.log("✅ Subject créé:", subject.name, "(ID:", subject._id + ")");
    } else {
      console.log("ℹ️  Subject existant:", subject.name);
    }

    // ── 3. EducationLevel ──────────────────────────────────────────────
    let educationLevel = await EducationLevel.findOne({
      code: "LICENCE-L1-FR",
    });
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

    // ── 4. Teacher (Account système) ──────────────────────────────────
    let teacher = await User.findOne({ email: "system-teacher@Xkorienta.app" });
    if (!teacher) {
      teacher = await User.create({
        name: "Équipe Xkorienta",
        email: "system-teacher@Xkorienta.app",
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
      console.log("✅ Teacher système créé:", teacher.name);
    } else {
      // Fallback : utiliser n'importe quel enseignant existant
      if (!teacher) {
        teacher = await User.findOne({ role: "TEACHER" });
      }
      console.log(
        "ℹ️  Teacher existant:",
        teacher ? teacher.name : "non trouvé",
      );
    }

    // Si pas d'enseignant du tout, créer un fallback
    if (!teacher) {
      teacher = await User.create({
        name: "Équipe Xkorienta",
        email: "system-teacher@Xkorienta.app",
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
    }

    // ── 5. Exam (Diagnostic Flash) ─────────────────────────────────────
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
      duration: 10,
      closeMode: "PERMISSIVE",
      status: "PUBLISHED",
      isPublished: true,
      isActive: true,
      isPublicDemo: true,
      publishedAt: now,
      createdById: teacher._id,
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
        lateDuration: 0,
        delayResultsUntilLateEnd: false,
      },
      stats: {
        totalAttempts: 0,
        totalCompletions: 0,
        averageScore: 0,
        averageTime: 0,
        passRate: 0,
      },
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
      version: 1,
      previousVersions: [],
    });

    console.log("\n✅ Exam créé:", exam.title);
    console.log("   ID:", exam._id.toString());

    // ── 6. Questions & Options ─────────────────────────────────────────
    console.log("\n📝 Création des questions...\n");
    let questionCount = 0;
    let optionCount = 0;

    for (const qData of QUESTIONS_DATA) {
      const { options: optionsData, ...questionFields } = qData;

      const question = await Question.create({
        examId: exam._id,
        text: questionFields.text,
        type: "QCM",
        points: questionFields.points,
        difficulty: questionFields.difficulty,
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

      for (const optData of optionsData) {
        await Option.create({
          questionId: question._id,
          text: optData.text,
          isCorrect: optData.isCorrect,
          explanation: optData.explanation,
          order: optData.order,
          stats: { timesSelected: 0, selectionRate: 0 },
        });
        optionCount++;
      }

      console.log(
        `   ✅ Q${questionFields.order}: ${questionFields.text.substring(0, 65)}...`,
      );
      questionCount++;
    }

    // ── Résumé ────────────────────────────────────────────────────────
    const totalPoints = QUESTIONS_DATA.reduce((sum, q) => sum + q.points, 0);

    console.log("\n" + "═".repeat(60));
    console.log("🎉 SEED TERMINÉ AVEC SUCCÈS !");
    console.log("═".repeat(60));
    console.log(`\n📊 Résumé:`);
    console.log(`   📚 Matière     : Programmation Web (PROG-WEB-101)`);
    console.log(`   📝 Questions   : ${questionCount}`);
    console.log(`   🔘 Options     : ${optionCount}`);
    console.log(`   🏆 Points tot. : ${totalPoints}`);
    console.log(`   ⏱️  Durée       : 10 minutes`);
    console.log(`   🆔 Exam ID     : ${exam._id.toString()}`);
    console.log(`\n🌐 Accès:`);
    console.log(`   Liste        : http://localhost:3000/mini-test`);
    console.log(
      `   Test direct  : http://localhost:3000/mini-test/${exam._id.toString()}`,
    );
    console.log("\n" + "═".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Erreur lors du seed:", error.message);
    if (error.code === 11000) {
      console.error(
        "   Contrainte d'unicité violée. Clé dupliquée:",
        JSON.stringify(error.keyValue),
      );
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("✓ Connexion MongoDB fermée.");
    process.exit(0);
  }
}

seedWebProgrammingDiagnostic();
