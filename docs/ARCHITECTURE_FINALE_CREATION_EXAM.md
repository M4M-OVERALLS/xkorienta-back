# 🏗️ ARCHITECTURE FINALE : Système de Création d'Examen QuizLock

## 🎯 Vision complète (Expert en Éducation)

Cette architecture couvre **TOUS** les types d'évaluations du système éducatif camerounais et francophone, avec une compréhension précise de la relation **Syllabus → Chapitres → Concepts**.

---

## 📚 HIÉRARCHIE PÉDAGOGIQUE

```
📖 SYLLABUS (Syllabus de la matière)
    │
    ├── 📘 CHAPITRE 1 (Module/Unité d'apprentissage)
    │    ├── 🎯 Concept 1.1
    │    ├── 🎯 Concept 1.2
    │    └── 🎯 Concept 1.3
    │
    ├── 📘 CHAPITRE 2
    │    ├── 🎯 Concept 2.1
    │    ├── 🎯 Concept 2.2
    │    └── 🎯 Concept 2.3
    │
    └── 📘 CHAPITRE N
         ├── 🎯 Concept N.1
         └── 🎯 Concept N.2
```

### Modèle actuel (à améliorer)

```typescript
// ❌ PROBLÈME : Un examen ne peut être lié qu'à UN chapitre
interface IExam {
  learningUnit?: ObjectId; // UN SEUL chapitre
  linkedConcepts?: ObjectId[];
}

// ✅ SOLUTION : Permettre plusieurs chapitres
interface IExam {
  learningUnits: ObjectId[]; // PLUSIEURS chapitres possibles
  linkedConcepts?: ObjectId[]; // Concepts de ces chapitres
  chapterWeights?: {
    // Optionnel : pondération
    learningUnit: ObjectId;
    weight: number; // % de questions sur ce chapitre
  }[];
}
```

---

## 🎓 TAXONOMIE COMPLÈTE DES ÉVALUATIONS

### Enum ExamType (25+ types)

```typescript
export enum ExamType {
  // ========== 1. ÉVALUATIONS DIAGNOSTIQUES ==========
  DIAGNOSTIC_TEST = "DIAGNOSTIC_TEST", // Test de positionnement
  PRE_TEST = "PRE_TEST", // Pré-test (avant chapitre)

  // ========== 2. ÉVALUATIONS FORMATIVES ==========
  SELF_ASSESSMENT = "SELF_ASSESSMENT", // Auto-évaluation (7 niveaux/concept)
  FORMATIVE_QUIZ = "FORMATIVE_QUIZ", // Quiz formatif
  PRACTICE_TEST = "PRACTICE_TEST", // Test d'entraînement
  HOMEWORK = "HOMEWORK", // Devoir à la maison
  REVISION_QUIZ = "REVISION_QUIZ", // Quiz de révision

  // ========== 3. ÉVALUATIONS SOMMATIVES ==========
  // 3.1 Interrogations
  QUIZ_ANNOUNCED = "QUIZ_ANNOUNCED", // Interrogation annoncée
  QUIZ_SURPRISE = "QUIZ_SURPRISE", // Interrogation surprise

  // 3.2 Contrôles
  CONTINUOUS_ASSESSMENT = "CONTINUOUS_ASSESSMENT", // Contrôle continu (CC)
  SUPERVISED_TEST = "SUPERVISED_TEST", // Devoir surveillé (DS)

  // 3.3 Examens officiels
  MIDTERM_EXAM = "MIDTERM_EXAM", // Examen de mi-session / Partiel
  FINAL_EXAM = "FINAL_EXAM", // Examen final
  RETAKE_EXAM = "RETAKE_EXAM", // Examen de rattrapage

  // ========== 4. ÉVALUATIONS SPÉCIALES ==========
  MOCK_EXAM = "MOCK_EXAM", // Examen blanc
  PRACTICAL_WORK = "PRACTICAL_WORK", // Travaux pratiques (TP)
  LAB_WORK = "LAB_WORK", // Travaux de laboratoire
  PROJECT_GROUP = "PROJECT_GROUP", // Projet de groupe
  PROJECT_INDIVIDUAL = "PROJECT_INDIVIDUAL", // Projet individuel
  ORAL_PRESENTATION = "ORAL_PRESENTATION", // Exposé oral
  ORAL_DEFENSE = "ORAL_DEFENSE", // Soutenance
  PORTFOLIO = "PORTFOLIO", // Dossier / Portfolio
  CASE_STUDY = "CASE_STUDY", // Étude de cas

  // ========== 5. COMPÉTITIONS ==========
  CLASS_CHALLENGE = "CLASS_CHALLENGE", // Challenge inter-classes
  SCHOOL_COMPETITION = "SCHOOL_COMPETITION", // Compétition inter-écoles
  OLYMPIAD = "OLYMPIAD", // Olympiade

  // ========== 6. ADAPTATIF ==========
  ADAPTIVE_ASSESSMENT = "ADAPTIVE_ASSESSMENT", // Évaluation adaptative
  PERSONALIZED_TEST = "PERSONALIZED_TEST", // Test personnalisé
}
```

---

## 🎯 AUTO-ÉVALUATION (Spécificité QuizLock)

### Principe : 7 NIVEAUX d'auto-évaluation par concept

```typescript
// Échelle d'auto-évaluation
enum SelfAssessmentLevel {
  UNKNOWN = 0, // ❓ Je ne sais pas
  TOTALLY_UNABLE = 1, // 😵 Totalement incapable
  UNABLE_WITH_HELP = 2, // 😰 Incapable même avec aide
  UNABLE_ALONE = 3, // 🤔 Incapable sans aide
  ABLE_WITH_HELP = 4, // 🙂 Capable avec aide
  ABLE_ALONE = 5, // 😊 Capable sans aide
  PERFECTLY_ABLE = 6, // 🌟 Parfaitement capable
}
```

### Configuration de l'auto-évaluation

```typescript
interface SelfAssessmentConfig {
  enabled: boolean;
  scale: {
    min: 0; // ❓ Je ne sais pas
    max: 6; // 🌟 Parfaitement capable
  };
  levels: {
    value: number;
    emoji: string;
    label: string;
  }[];
  requireAllConcepts: boolean; // Évaluer TOUS les concepts ?
  allowMultipleAttempts: boolean; // Refaire plusieurs fois ?
}
```

### Résultat d'auto-évaluation

```typescript
interface ConceptSelfAssessment {
  concept: ObjectId;
  level: SelfAssessmentLevel; // 0-6
  timestamp: Date;
}

interface SelfAssessmentResult {
  exam: ObjectId;
  student: ObjectId;
  chapter: ObjectId; // Le chapitre évalué
  conceptAssessments: ConceptSelfAssessment[];

  // Agrégations
  averageLevel: number;
  strongConcepts: ObjectId[]; // Niveaux 5-6
  moderateConcepts: ObjectId[]; // Niveaux 3-4
  weakConcepts: ObjectId[]; // Niveaux 1-2
  unknownConcepts: ObjectId[]; // Niveau 0

  createdAt: Date;
}
```

---

## 📊 MATRICE COMPLÈTE PAR TYPE D'EXAMEN

| ExamType                        | Chapitres | Graded | Weight | Tentatives | Anti-Cheat | Résultats              |
| ------------------------------- | --------- | ------ | ------ | ---------- | ---------- | ---------------------- |
| **DIAGNOSTIQUES**               |
| DIAGNOSTIC_TEST                 | 1-2       | ❌     | 0%     | 1          | ❌         | Immédiat               |
| PRE_TEST                        | 1         | ❌     | 0%     | 1          | ❌         | Immédiat               |
| **FORMATIVES**                  |
| SELF_ASSESSMENT                 | 1         | ❌     | 0%     | ∞          | ❌         | Immédiat + Carte       |
| FORMATIVE_QUIZ                  | 1-2       | ❌     | 0%     | 2-3        | ❌         | Immédiat               |
| PRACTICE_TEST                   | 1-3       | ❌     | 0%     | ∞          | ❌         | Immédiat               |
| HOMEWORK                        | 1-2       | ⚠️     | 5-10%  | 2          | ❌         | Différé                |
| REVISION_QUIZ                   | 2-4       | ❌     | 0%     | 3          | ❌         | Immédiat               |
| **SOMMATIVES - Interrogations** |
| QUIZ_ANNOUNCED                  | 1-2       | ✅     | 10%    | 1          | ⚠️         | Différé                |
| QUIZ_SURPRISE                   | 1         | ✅     | 5-10%  | 1          | ⚠️         | Différé                |
| **SOMMATIVES - Contrôles**      |
| CONTINUOUS_ASSESSMENT           | 3-5       | ✅     | 15-20% | 1          | ✅         | Différé                |
| SUPERVISED_TEST                 | 4-6       | ✅     | 20-25% | 1          | ✅         | Différé                |
| **SOMMATIVES - Examens**        |
| MIDTERM_EXAM                    | 8-12      | ✅     | 30-40% | 1          | ✅✅       | Différé                |
| FINAL_EXAM                      | TOUS      | ✅     | 50-60% | 1          | ✅✅✅     | Différé                |
| RETAKE_EXAM                     | TOUS      | ✅     | 100%   | 1          | ✅✅✅     | Différé                |
| **SPÉCIALES**                   |
| MOCK_EXAM                       | TOUS      | ❌     | 0%     | 2          | ⚠️         | Immédiat               |
| PRACTICAL_WORK                  | 1-2       | ✅     | 15-20% | 1          | ❌         | Différé + Rubric       |
| PROJECT_GROUP                   | 2-5       | ✅     | 20-30% | 1          | ❌         | Différé + Rubric       |
| PROJECT_INDIVIDUAL              | 2-3       | ✅     | 15-20% | 1          | ❌         | Différé + Rubric       |
| ORAL_PRESENTATION               | 1-2       | ✅     | 10-15% | 1          | ❌         | Immédiat + Rubric      |
| ORAL_DEFENSE                    | 1-All     | ✅     | 20-30% | 1          | ❌         | Immédiat + Rubric      |
| **COMPÉTITIONS**                |
| CLASS_CHALLENGE                 | 3-5       | ❌     | Bonus  | 1          | ⚠️         | Immédiat + Leaderboard |
| SCHOOL_COMPETITION              | 5-10      | ❌     | Bonus  | 1          | ✅         | Immédiat + Leaderboard |
| OLYMPIAD                        | TOUS      | ❌     | Certif | 1          | ✅✅       | Différé + Classement   |

---

## 🏗️ NOUVEAU MODÈLE EXAM (Complet)

```typescript
export interface IExam extends Document {
  _id: ObjectId;

  // ========== IDENTIFICATION ==========
  title: string;
  description?: string;
  imageUrl?: string;

  // ========== TYPE (NOUVEAU) ==========
  examType: ExamType; // 🆕 Type principal (remplace confusion actuelle)
  subType?: string; // 🆕 Sous-type si nécessaire (REGULAR, RETAKE, etc.)

  // ========== CONTEXTE ==========
  schoolType?: SchoolType;
  subSystem: SubSystem;
  targetLevels: ObjectId[]; // Niveaux éducatifs ciblés
  subject: ObjectId; // Matière

  // ========== CONTENU PÉDAGOGIQUE (AMÉLIORÉ) ==========
  syllabus?: ObjectId;
  learningUnits: ObjectId[]; // 🆕 PLUSIEURS chapitres (au lieu d'un seul)
  linkedConcepts?: ObjectId[]; // Concepts de ces chapitres

  // 🆕 Pondération par chapitre (optionnel)
  chapterWeights?: {
    learningUnit: ObjectId;
    weight: number; // Pourcentage de questions (ex: 30%)
  }[];

  targetFields?: ObjectId[]; // Séries/Filières
  targetedCompetencies?: ObjectId[]; // Compétences

  // ========== AUTO-ÉVALUATION ==========
  selfAssessmentConfig?: {
    enabled: boolean;
    scale: { min: number; max: number }; // 0-6
    levels: {
      value: number;
      emoji: string;
      label: string;
    }[];
    requireAllConcepts: boolean;
    allowMultipleAttempts: boolean;
  };

  // ========== NOTATION ==========
  graded: boolean; // 🆕 Compte pour la moyenne ?
  weightInFinalGrade?: number; // 🆕 Poids dans la moyenne (%)

  // ========== PÉDAGOGIE (ANCIENS CHAMPS - Pour compatibilité) ==========
  pedagogicalObjective: PedagogicalObjective;
  evaluationType: EvaluationType;
  learningMode: LearningMode;
  difficultyLevel: DifficultyLevel;

  // ========== TIMING ==========
  startTime: Date;
  endTime: Date;
  duration: number; // Minutes
  closeMode: CloseMode;

  // ========== CONFIGURATION ==========
  config: ExamConfig;
  status: ExamStatus;
  isPublished: boolean;
  isActive: boolean;
  isPublicDemo: boolean;

  // ========== MÉTADONNÉES ==========
  createdById: ObjectId;
  validatedBy?: ObjectId;
  validatedAt?: Date;
  publishedAt?: Date;
  tags: string[];
  version: number;

  // ========== STATISTIQUES ==========
  stats: ExamStats;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 📝 INTÉGRATION DES QUESTIONS (CRÉATION MANUELLE)

Le modèle `IExam` gère l'enveloppe et la configuration, mais l'évaluation n'est rien sans ses questions. La refonte prend en charge la **création manuelle intuitive** (QCM, Vrai/Faux, Ouvertes) avec une liaison directe vers l'architecture académique.

### Le Modèle Question Associé

Pour lier précisément les questions au cursus académique :

```typescript
export interface IQuestion extends Document {
  _id: ObjectId;
  examId: ObjectId;

  // ========== CONTENU PÉDAGOGIQUE ==========
  text: string;
  type: EvaluationType; // QCM, TRUE_FALSE, OPEN_QUESTION
  points: number;
  difficulty: DifficultyLevel;

  // 🆕 LIEN AVEC LE CURSUS ACADÉMIQUE
  learningUnitId?: ObjectId; // Le chapitre évalué par cette question
  conceptId?: ObjectId; // Le concept précis évalué (optionnel, ultra-précis)

  // ========== RÉPONSES (Selon le type) ==========
  options?: {
    // Pour QCM
    text: string;
    isCorrect: boolean;
    feedback?: string; // Explication pédagogique
  }[];
  correctAnswer?: boolean; // Pour TRUE_FALSE
  modelAnswer?: string; // Pour OPEN_QUESTION

  // ========== CORRECTION AVANCÉE (IA) ==========
  openQuestionConfig?: {
    // Pour OPEN_QUESTION
    gradingMode: "keywords" | "semantic" | "manual" | "hybrid";
    semanticThreshold: number;
    keywords: { word: string; weight: number; required: boolean }[];
  };
}
```

### Workflow Pédagogique (Nouvelle Interface V4)

Dans la nouvelle interface utilisateur dédiée (ex: `/teacher/exams/builder-v4`), la création manuelle ne devient pas plus compliquée, mais **plus intelligente**. Elle suit cette logique fluide :

1. **Choix du Contexte (Étape 1 & 2)**
   - L'enseignant choisit la Matière et la Classe (ex: Mathématiques, Terminale C).
   - Il sélectionne le ou les **Chapitres (Learning Units)** pertinents depuis le Syllabus.

2. **Configuration (Étape 3)**
   - Choix du Modèle (Contrôle, Auto-évaluation, Examen Final).
   - L'enveloppe de l'examen est générée avec les règles de temps, visibilité, et anti-triche adaptées.

3. **Éditeur de Questions (Étape 4)**
   - L'éditeur (actuel QCM, Vrai/Faux, Ouvertes) est conservé et amélioré.
   - **Tagging Pédagogique Dynamique :** Chaque question a un menu déroulant permettant d'y associer un **Concept** des chapitres choisis plus tôt.
   - _Avantage :_ Si la question 1 porte sur "Primitive" et l'élève échoue, l'algorithme sait exactement que l'élève a une lacune sur ce concept précis, sans effort supplémentaire de configuration globale.
   - **Correction Intelligente :** L'enseignant configure les questions ouvertes (IA hybride) comme il a l'habitude de le faire.

Ce flux réconcilie l'aspect macro-académique (**Syllabus ➔ Chapitres ➔ Poids**) avec la réalité pratique de l'enseignant qui écrit ses questions une par une, offrant le meilleur des deux mondes.

---

## 📦 TEMPLATES PAR TYPE

### Template 1 : Auto-évaluation

```typescript
{
    id: 'self-assessment',
    examType: ExamType.SELF_ASSESSMENT,
    name: 'Auto-évaluation d\'un chapitre',
    icon: '🤔',
    description: 'Évaluez votre maîtrise des concepts d\'un chapitre',

    defaultConfig: {
        learningUnits: [],  // Sélection d'UN chapitre
        linkedConcepts: [],  // Auto-rempli depuis le chapitre

        selfAssessmentConfig: {
            enabled: true,
            scale: { min: 0, max: 6 },
            levels: [
                { value: 0, emoji: "❓", label: "Je ne sais pas" },
                { value: 1, emoji: "😵", label: "Totalement incapable" },
                { value: 2, emoji: "😰", label: "Incapable même avec aide" },
                { value: 3, emoji: "🤔", label: "Incapable sans aide" },
                { value: 4, emoji: "🙂", label: "Capable avec aide" },
                { value: 5, emoji: "😊", label: "Capable sans aide" },
                { value: 6, emoji: "🌟", label: "Parfaitement capable" }
            ],
            requireAllConcepts: true,
            allowMultipleAttempts: true
        },

        graded: false,
        config: {
            duration: null,  // Pas de limite
            showResultsImmediately: true,
            maxAttempts: -1,
            enableConceptMapping: true
        }
    },

    constraints: {
        minChapters: 1,
        maxChapters: 1,
        requiresConcepts: true
    },

    recommendations: {
        tips: [
            'Soyez honnête dans votre auto-évaluation',
            'Refaites régulièrement pour suivre votre progression',
            'Concentrez-vous sur les concepts faibles identifiés'
        ]
    }
}
```

### Template 2 : Contrôle continu

```typescript
{
    id: 'continuous-assessment',
    examType: ExamType.CONTINUOUS_ASSESSMENT,
    name: 'Contrôle Continu (CC)',
    icon: '📝',
    description: 'Évaluation notée sur plusieurs chapitres',

    defaultConfig: {
        learningUnits: [],  // 3-5 chapitres
        chapterWeights: [
            { learningUnit: null, weight: 25 },
            { learningUnit: null, weight: 25 },
            { learningUnit: null, weight: 25 },
            { learningUnit: null, weight: 25 }
        ],

        graded: true,
        weightInFinalGrade: 20,

        config: {
            duration: 60,
            showResultsImmediately: false,
            maxAttempts: 1,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                maxTabSwitches: 3
            }
        }
    },

    constraints: {
        minChapters: 3,
        maxChapters: 5,
        requiresProctor: false
    },

    recommendations: {
        questionCount: 25,
        timePerQuestion: 2.5,
        tips: [
            'Couvre généralement 1 mois de cours',
            'Note compte pour 15-20% de la moyenne',
            'Anti-triche activé'
        ]
    }
}
```

### Template 3 : Examen final

```typescript
{
    id: 'final-exam',
    examType: ExamType.FINAL_EXAM,
    name: 'Examen Final',
    icon: '🎓',
    description: 'Examen final sur tout le Syllabus',

    defaultConfig: {
        learningUnits: [],  // TOUS les chapitres du syllabus
        chapterWeights: null,  // Distribution équilibrée auto

        graded: true,
        weightInFinalGrade: 60,

        config: {
            duration: 180,
            showResultsImmediately: false,
            delayResultsUntilLateEnd: true,
            maxAttempts: 1,
            requiresProctor: true,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                preventScreenshot: true,
                blockRightClick: true,
                maxTabSwitches: 0
            }
        }
    },

    constraints: {
        minChapters: 10,  // Au moins 10 chapitres
        maxChapters: 999,  // Tous
        requiresProctor: true
    },

    recommendations: {
        questionCount: 50,
        timePerQuestion: 3.5,
        tips: [
            'Couvre TOUT le Syllabus',
            'Note compte pour 50-60% de la moyenne',
            'Conditions maximales de sécurité',
            'Résultats différés jusqu\'à fin rattrapage'
        ]
    }
}
```

---

## 🎨 EXEMPLE CONCRET : Examen de Mathématiques Tle C

### Scénario 1 : Auto-évaluation Chapitre 3

```typescript
{
    examType: ExamType.SELF_ASSESSMENT,
    title: "Auto-évaluation : Les Intégrales",
    subject: "Mathématiques",
    targetLevels: ["Terminale C"],
    syllabus: "Syllabus Mathématiques Tle C 2024-2025",

    // UN SEUL chapitre
    learningUnits: ["Chapitre 3: Les Intégrales"],

    // Concepts du chapitre (auto-remplis)
    linkedConcepts: [
        "Primitive d'une fonction",
        "Intégrale définie",
        "Aire sous la courbe",
        "Théorème fondamental",
        "Intégration par parties",
        "Changement de variable"
    ],

    selfAssessmentConfig: {
        enabled: true,
        scale: { min: 0, max: 6 },
        levels: [...], // 7 niveaux
        requireAllConcepts: true,
        allowMultipleAttempts: true
    },

    graded: false,
    config: {
        duration: null,
        showResultsImmediately: true,
        maxAttempts: -1
    }
}

// Résultat attendu :
// Cartographie :
//   ✅ Points forts (5-6) : Primitive, Intégrale définie
//   ⚠️ En cours (3-4) : Aire sous courbe, Théorème fondamental
//   ❌ À retravailler (1-2) : Intégration par parties, Changement de variable
```

### Scénario 2 : Contrôle continu CC2

```typescript
{
    examType: ExamType.CONTINUOUS_ASSESSMENT,
    number: 2,  // CC2
    title: "Contrôle Continu N°2 - Premier Trimestre",
    subject: "Mathématiques",
    targetLevels: ["Terminale C"],
    syllabus: "Syllabus Mathématiques Tle C 2024-2025",

    // PLUSIEURS chapitres
    learningUnits: [
        "Chapitre 1: Suites numériques",
        "Chapitre 2: Fonctions",
        "Chapitre 3: Intégrales",
        "Chapitre 4: Nombres complexes"
    ],

    // Pondération par chapitre
    chapterWeights: [
        { learningUnit: "Ch1", weight: 15 },  // 15% des questions
        { learningUnit: "Ch2", weight: 25 },  // 25% des questions
        { learningUnit: "Ch3", weight: 35 },  // 35% des questions (récent)
        { learningUnit: "Ch4", weight: 25 }   // 25% des questions
    ],

    graded: true,
    weightInFinalGrade: 20,  // Compte pour 20% de la moyenne

    config: {
        duration: 60,
        showResultsImmediately: false,
        maxAttempts: 1,
        antiCheat: {
            fullscreenRequired: true,
            disableCopyPaste: true,
            trackTabSwitches: true,
            maxTabSwitches: 3
        }
    }
}
```

### Scénario 3 : Examen Final

```typescript
{
    examType: ExamType.FINAL_EXAM,
    subType: 'REGULAR',
    title: "Examen Final - Mathématiques Tle C",
    subject: "Mathématiques",
    targetLevels: ["Terminale C"],
    syllabus: "Syllabus Mathématiques Tle C 2024-2025",

    // TOUS les chapitres du Syllabus
    learningUnits: [
        "Ch1: Suites numériques",
        "Ch2: Fonctions",
        "Ch3: Intégrales",
        "Ch4: Nombres complexes",
        "Ch5: Géométrie dans l'espace",
        "Ch6: Probabilités",
        "Ch7: Statistiques",
        "Ch8: Équations différentielles",
        "Ch9: Arithmétique",
        "Ch10: Matrices",
        "Ch11: Déterminants",
        "Ch12: Systèmes linéaires",
        "Ch13: Coniques",
        "Ch14: Transformations",
        "Ch15: Trigonométrie avancée"
    ],  // 15 chapitres

    // Pas de pondération spécifique = distribution équilibrée
    chapterWeights: null,

    graded: true,
    weightInFinalGrade: 60,  // 60% de la moyenne finale !

    config: {
        duration: 180,  // 3 heures
        showResultsImmediately: false,
        delayResultsUntilLateEnd: true,
        maxAttempts: 1,
        requiresProctor: true,
        antiCheat: {
            fullscreenRequired: true,
            disableCopyPaste: true,
            trackTabSwitches: true,
            webcamRequired: true,
            preventScreenshot: true,
            blockRightClick: true,
            maxTabSwitches: 0  // Aucun changement d'onglet autorisé
        }
    }
}
```

---

## 🚀 PLAN D'IMPLÉMENTATION

### Phase 1 : Modèles de données (1 semaine)

```
✅ Modifier Exam :
   - learningUnit? → learningUnits[]
   - Ajouter examType
   - Ajouter graded, weightInFinalGrade
   - Ajouter selfAssessmentConfig
   - Ajouter chapterWeights

✅ Créer SelfAssessmentResult :
   - Stocker les évaluations par concept
   - Générer cartographie

🔴 [CRITIQUE] Modifier IQuestion — Barème par sous-compétence :
   - Ajouter subCriteria[] dans le modèle IQuestion (Mongoose + TypeScript)
   - Chaque sous-critère a : label, points, conceptId? (optionnel)
   - Mettre à jour le calcul du score total (sum des subCriteria.points)
   - Mettre à jour l'API de soumission pour accepter les sous-notes

🔴 [CRITIQUE] Modifier EvaluationType :
   - Ajouter RUBRIC à l'enum (pour TP, Soutenances)

✅ Migration des données existantes
```

### Phase 2 : Backend (1 semaine)

```
✅ Créer templates (25 types)
   🔴 [MANQUANT] Ajouter templates : PRACTICAL_WORK, LAB_WORK, ORAL_DEFENSE, PORTFOLIO
✅ ExamBuilder avec support multi-chapitres
✅ Validation contextuelle
✅ API routes V4
🔴 [CRITIQUE] Scoring Engine : calculer la note finale en agrégeant les subCriteria[]
```

### Phase 3 : Frontend (2 semaines)

```
✅ Wizard de création (nouvelle page /teacher/exams/builder)
✅ Sélecteur de chapitres (multi-select)
✅ Interface auto-évaluation (7 niveaux)
✅ Cartographie des compétences
✅ Graphiques de progression

🔴 [CRITIQUE] Éditeur de question avec sous-barème :
   - Nouveau composant SubCriteriaEditor.tsx
   - Pour chaque question ouverte, le prof peut ajouter des sous-parties (a, b, c...)
   - Chaque sous-partie a un label, des points, et un conceptId optionnel
   - L'UI affiche le total des sous-points = points de la question
   - Drag & drop pour réordonner les sous-parties

🔴 [CRITIQUE] Éditeur RUBRIC (pour les TP et Soutenances) :
   - Nouveau composant RubricEditor.tsx
   - Tableau de critères avec weights et descripteurs de performance
   - Mode notation manuelle : le prof remplit les notes après la session
```

### Phase 4 : Tests (1 semaine)

```
✅ Tests unitaires
✅ Tests d'intégration
✅ Tests E2E
```

**Total : ~5 semaines**

---

## 🚨 DÉCALAGE FRONT-END ACTUEL vs ARCHITECTURE V4 (Checklist pour la Nouvelle Interface)

Pour ne pas affecter la stabilité du système actuel, **l'ancienne page `/teacher/exams/create` ne sera pas modifiée**. À la place, une nouvelle série de composants (V4) sera créée de zéro en reprenant le meilleur de l'UX existante, mais en y intégrant les changements suivants :

### 1. Multi-chapitres (Step 1 : Classification)

- **Problème :** Le choix de chapitre (`selectedContext` dans `Step1Classification.tsx`) utilise des boutons radios et ne retient qu'une seule sélection au format `string` (`learningUnit`).
- **Correction requise :** Passer l'état en tableau (`learningUnits: string[]`), remplacer les boutons par des cases à cocher (_multiselect_), et transmettre un tableau d'ObjectIds au parent.

### 2. Taxonomie et Notation (Step 3 : Configuration)

- **Problème :** L'UI repose encore sur l'ancienne logique `pedagogicalObjective` (Formatif, Sommatif...) et passe à côté des 25+ types d'examens précis.
- **Correction requise :**
  - Remplacer le sélecteur d'objectif par un **Sélecteur de Type d'Examen (`ExamType`)** (ex: Contrôle Continu, Examen Final, Auto-évaluation).
  - Ajouter un champ **"Est-ce noté ?" (`graded: boolean`)**.
  - Si noté, ajouter un champ **"Coefficient/Pourcentage" (`weightInFinalGrade: number`)**.

### 3. Tagging des Questions pour l'IA (Step 4 : QuestionEditor)

- **Problème :** Dans `Step4QuestionEditor.tsx`, le menu déroulant _"Concept à évaluer"_ (pour lier une question à un `conceptId` du syllabus) est conditionnellement caché : `if (isSelfAssessment) {...}`.
- **Correction requise :** Retirer cette condition. Les questions de tous les types d'examens (Contrôle, Examen final, etc.) doivent pouvoir être taguées sur un concept précis. C'est le cœur de l'analyse IA des lacunes.

### 4. Pondération des Chapitres (UX Optionnelle)

- **Amélioration :** Si l'enseignant sélectionne 3 chapitres au Step 1, le Step 3 pourrait afficher de simples jauges pour définir le `chapterWeights` (ex: 50% sur le Chapitre 1, 25% sur les 2 et 3).

---

## 🎓 BESOINS SPÉCIFIQUES PROFESSEUR D'UNIVERSITÉ

### Ce qui est parfaitement couvert ✅

Un enseignant universitaire peut créer **toutes ses évaluations courantes** :

| Besoin                      | ExamType                           | Détail                              |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| Partiel de mi-semestre      | `MIDTERM_EXAM`                     | 2h, webcam, résultats différés      |
| Examen final semestriel     | `FINAL_EXAM`                       | 3h, tous chapitres, anti-triche max |
| Rattrapage                  | `RETAKE_EXAM`                      | Conditions identiques au final      |
| Contrôle continu            | `CONTINUOUS_ASSESSMENT`            | 30% de la note finale               |
| Devoir maison               | `HOMEWORK`                         | Sans anti-triche, 10%               |
| Examen blanc                | `MOCK_EXAM`                        | Simulation en conditions réelles    |
| Interrogation               | `QUIZ_ANNOUNCED` / `QUIZ_SURPRISE` | Courte, notée                       |
| Auto-évaluation de chapitre | `SELF_ASSESSMENT`                  | 7 niveaux par concept               |

---

### Angles morts à combler pour l'université ❌

#### 🔴 Angle mort #1 : Travaux Pratiques / Lab (TP)

`PRACTICAL_WORK` et `LAB_WORK` sont dans l'enum mais **il n'existe aucun `ExamTemplate` pour eux**.
Un TP universitaire (Médecine, Sciences, Informatique) ne se note **pas** avec des QCM ou des questions ouvertes classiques.

**Ce qu'il faut ajouter :**

```typescript
// Nouveau type de question : RUBRIC (grille de critères)
interface IRubricQuestion extends IQuestion {
    type: 'RUBRIC'
    criteria: {
        label: string         // ex: "Montage du circuit"
        maxPoints: number     // ex: 5
        description?: string  // Aide à la notation
    }[]
}

// Template à créer dans ExamTemplate.ts
{
    id: 'practical-work',
    examType: ExamType.PRACTICAL_WORK,
    name: 'Travaux pratiques (TP)',
    description: 'Évaluation de séance de TP avec grille de critères',
    category: 'SPECIAL',
    defaultConfig: {
        evaluationType: EvaluationType.RUBRIC,  // À ajouter à l'enum
        graded: true,
        weightInFinalGrade: 20,
        showResultsImmediately: false,
        antiCheat: { fullscreenRequired: false, ... },  // Pas d'anti-triche
        suggestedDuration: 120
    },
    recommendations: { minQuestions: 3, maxQuestions: 8, idealChapterCount: 1 }
}
```

---

#### 🔴 Angle mort #2 : Soutenance / Oral Defense / Portfolio

`ORAL_DEFENSE`, `ORAL_PRESENTATION`, `PORTFOLIO` sont dans l'enum mais **sans template ni modèle adapté**.
Une soutenance de mémoire se note sur **des critères pédagogiques** (Clarté, Maîtrise du sujet, Réponses aux questions), pas sur des QCM.

**Ce qu'il faut ajouter :**

```typescript
// Interface pour une grille de soutenance
interface IOralRubric {
    criterion: string       // ex: "Clarté de la présentation"
    weight: number          // ex: 25 (= 25% de la note)
    maxScore: number        // ex: 20
    descriptors?: {         // Niveaux de performance
        score: number
        description: string // ex: "Présentation claire et structurée"
    }[]
}

// Template à créer
{
    id: 'oral-defense',
    examType: ExamType.ORAL_DEFENSE,
    name: 'Soutenance',
    category: 'SPECIAL',
    defaultConfig: {
        evaluationType: EvaluationType.RUBRIC,
        graded: true,
        weightInFinalGrade: 30,
        suggestedDuration: 30  // 30 min par étudiant
    }
}
```

---

#### 🟡 Angle mort #3 : Barème par Sous-Compétence sur Question Ouverte

Un prof universitaire note souvent une **seule question sur plusieurs sous-parties** :

- _Question 1 (sur 20)_ : Définition → /5 pts | Démonstration → /10 pts | Application → /5 pts

**Ce qu'il faut ajouter dans `IQuestion` :**

```typescript
interface IQuestion {
  // ... champs existants ...
  subCriteria?: {
    // Sous-parties pour questions ouvertes
    label: string; // ex: "Démonstration mathématique"
    points: number; // ex: 10
    conceptId?: ObjectId; // Concept précis évalué dans cette sous-partie
  }[];
}
```

> **Impact :** Ce champ permettrait à l'IA d'analyser les lacunes au niveau de la **sous-partie** d'une question, pas juste à la question entière.

---

### Plan de travail pour l'Université (nouvelles tâches)

> ⚠️ **PRIORITÉ MAXIMALE** : Le barème par sous-compétence (`subCriteria`) est fondamental pour
> n'importe quel examen universitaire sérieux, pas seulement les TP. Il doit être implémenté
> en Phase 1 avant même de commencer l'interface V4.

#### 🔴 TÂCHE #U1 — IQuestion : Barème par sous-compétence `[BACKEND PRIORITAIRE]`

- **Fichier :** `quizlock-api/src/models/Question.ts`
- **Modifier :** Ajouter le champ `subCriteria` au schéma Mongoose

```typescript
// Dans Question.ts — à ajouter dans le schéma
subCriteria: [
  {
    label: { type: String, required: true }, // ex: "a) Définition"
    points: { type: Number, required: true }, // ex: 5
    conceptId: { type: ObjectId, ref: "Concept" }, // optionnel
  },
];
// La validation doit vérifier : sum(subCriteria.points) === question.points
```

#### 🔴 TÂCHE #U2 — EvaluationType : Ajouter RUBRIC `[BACKEND PRIORITAIRE]`

- **Fichier :** `quizlock-api/src/models/enums.ts`
- **Modifier :** Ajouter `RUBRIC = 'RUBRIC'` à l'enum `EvaluationType`

#### 🔴 TÂCHE #U3 — Scoring Engine : Calcul avec subCriteria `[BACKEND PRIORITAIRE]`

- **Fichier :** `quizlock-api/src/lib/services/ExamServiceV4.ts`
- **Modifier :** Le scoring doit agréger `subCriteria[].points` pour calculer la note
  d'une question quand `subCriteria` est présent

#### 🔴 TÂCHE #U4 — SubCriteriaEditor.tsx `[FRONTEND PRIORITAIRE]`

- **Fichier :** `quizlock-app/src/components/exam-builder/SubCriteriaEditor.tsx` _(à créer)_
- **Fonctionnement :**
  - S'affiche sous toute question de type `OPEN_QUESTION` ou `RUBRIC`
  - Permet d'ajouter des lignes `(label, points, concept optionnel)`
  - Le total des sous-points est affiché et doit égaler `question.points`
  - Drag & drop pour réordonner

#### 🟡 TÂCHE #U5 — ExamTemplate.ts : Templates manquants `[BACKEND MOYEN]`

- **Fichier :** `quizlock-api/src/lib/exam-templates/ExamTemplate.ts`
- **Ajouter :** Les templates pour `PRACTICAL_WORK`, `LAB_WORK`, `ORAL_DEFENSE`, `PORTFOLIO`

#### 🟡 TÂCHE #U6 — RubricEditor.tsx `[FRONTEND MOYEN]`

- **Fichier :** `quizlock-app/src/components/exam-builder/RubricEditor.tsx` _(à créer)_
- **Pour :** TP, Soutenances, Portfolios — grille de critères avec mode notation manuelle

---

## ✅ Points clés

1. **Multi-chapitres** : Un examen peut porter sur 1 à N chapitres
2. **Auto-évaluation** : 7 niveaux par concept (pas 7 dimensions)
3. **25+ types** : Couvre TOUS les cas du système éducatif
4. **Pondération** : Possibilité de définir le poids de chaque chapitre
5. **Notation claire** : graded + weightInFinalGrade
6. **Université** : TP, Soutenances et Barèmes par sous-compétence à compléter (voir section ci-dessus)

**Prêt pour implémentation ?**
