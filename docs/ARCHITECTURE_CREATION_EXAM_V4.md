# 🏗️ ARCHITECTURE PROPOSÉE : Création d'Examen V4

## 🎯 Vision globale

Transformer le processus de création d'examen en un système **guidé**, **contextuel** et **intelligent** basé sur des patterns de conception éprouvés.

---

## 📐 Principes de conception

### 1. **Separation of Concerns**

Chaque dimension a sa propre responsabilité :

- **Type d'évaluation** → Configuration + Workflow
- **Type d'école** → Contraintes pédagogiques
- **Contexte** → Validation école-classe-cycles
- **Syllabus** → Suggestions de concepts

### 2. **Builder Pattern**

Construction progressive avec validation incrémentale.

### 3. **Strategy Pattern**

Stratégies différentes selon le type d'évaluation.

### 4. **Template Method**

Workflow standardisé avec étapes personnalisables.

### 5. **Factory Pattern**

Création de builders préconfigurés selon le cas d'usage.

---

## 🧩 Architecture en couches

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER (UI)                     │
│                                                                  │
│  - ExamCreationWizard (React Component)                         │
│  - Étapes progressives avec validation temps réel               │
│  - Auto-save brouillon                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER (Routes)                         │
│                                                                  │
│  POST /api/exams/v4/initialize  → Créer brouillon               │
│  POST /api/exams/v4/templates   → Lister templates              │
│  PUT  /api/exams/v4/:id/step    → Compléter une étape           │
│  POST /api/exams/v4/:id/validate→ Valider avant publication     │
│  POST /api/exams/v4/:id/publish → Publier l'examen              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│                                                                  │
│  - ExamCreationOrchestrator                                     │
│  - ExamBuilderFactory                                           │
│  - ExamWorkflowManager                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DOMAIN LAYER                               │
│                                                                  │
│  - ExamBuilder (avec fluent API)                                │
│  - ExamTypeStrategy (SelfAssessment, Formative, Summative...)   │
│  - ValidationEngine                                             │
│  - ContextValidator (école-cycles-niveaux)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                          │
│                                                                  │
│  - ExamRepository                                               │
│  - SchoolRepository                                             │
│  - SyllabusRepository                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Nouveaux concepts

### 1. **ExamType** (nouveau enum)

Remplace la confusion actuelle entre `PedagogicalObjective`, `LearningMode`, et `EvaluationType`.

```typescript
export enum ExamType {
  // Auto-évaluations (sans pression)
  SELF_ASSESSMENT = "SELF_ASSESSMENT", // Auto-évaluation libre
  DIAGNOSTIC = "DIAGNOSTIC", // Évaluation diagnostique

  // Évaluations formatives (notes informatives)
  FORMATIVE_QUIZ = "FORMATIVE_QUIZ", // Quiz formatif rapide
  PRACTICE_TEST = "PRACTICE_TEST", // Test d'entraînement
  HOMEWORK = "HOMEWORK", // Devoir à la maison

  // Évaluations sommatives (notes comptent)
  GRADED_QUIZ = "GRADED_QUIZ", // Contrôle noté (QCM)
  EXAM = "EXAM", // Examen classique
  FINAL_EXAM = "FINAL_EXAM", // Examen final
  CERTIFICATION = "CERTIFICATION", // Certification officielle

  // Modes spéciaux
  COMPETITION = "COMPETITION", // Compétition/Challenge
  MOCK_EXAM = "MOCK_EXAM", // Examen blanc
  ADAPTIVE_ASSESSMENT = "ADAPTIVE_ASSESSMENT", // Évaluation adaptative
}
```

**Avantage** : Un seul choix → Configuration cohérente garantie.

### 2. **ExamTemplate**

Template préconfigurés pour les cas courants.

```typescript
interface ExamTemplate {
  id: string;
  type: ExamType;
  name: string;
  description: string;
  icon: string;
  // Configuration par défaut
  defaultConfig: {
    evaluationType: EvaluationType;
    pedagogicalObjective: PedagogicalObjective;
    learningMode: LearningMode;
    duration: number;
    passingScore?: number;
    config: Partial<ExamConfig>;
  };
  // Contraintes
  constraints: {
    minQuestions: number;
    maxQuestions: number;
    allowedQuestionTypes: EvaluationType[];
  };
  // Recommandations
  recommendations: {
    questionCount: number;
    timePerQuestion: number;
    tips: string[];
  };
}
```

**Exemples de templates** :

```typescript
const TEMPLATES: ExamTemplate[] = [
  {
    id: "self-assessment",
    type: ExamType.SELF_ASSESSMENT,
    name: "Auto-évaluation",
    description: "Évaluation libre pour réviser sans pression",
    icon: "📝",
    defaultConfig: {
      evaluationType: EvaluationType.QCM,
      pedagogicalObjective: PedagogicalObjective.SELF_ASSESSMENT,
      learningMode: LearningMode.AUTO_EVAL,
      duration: 20,
      config: {
        showResultsImmediately: true,
        allowReview: true,
        maxAttempts: -1, // Illimité
        enableImmediateFeedback: true,
        antiCheat: { fullscreenRequired: false },
      },
    },
    constraints: {
      minQuestions: 5,
      maxQuestions: 30,
      allowedQuestionTypes: [EvaluationType.QCM, EvaluationType.TRUE_FALSE],
    },
    recommendations: {
      questionCount: 15,
      timePerQuestion: 1.5,
      tips: [
        "Pas de limite de tentatives",
        "Feedback immédiat pour faciliter l'apprentissage",
        "Pas de note finale, juste un score informatif",
      ],
    },
  },

  {
    id: "formative-quiz",
    type: ExamType.FORMATIVE_QUIZ,
    name: "Quiz formatif",
    description: "Quiz rapide pour vérifier la compréhension",
    icon: "✅",
    defaultConfig: {
      evaluationType: EvaluationType.QCM,
      pedagogicalObjective: PedagogicalObjective.FORMATIVE_EVAL,
      learningMode: LearningMode.CLASS_CHALLENGE,
      duration: 15,
      config: {
        showResultsImmediately: true,
        allowReview: true,
        maxAttempts: 2,
        enableImmediateFeedback: true,
        antiCheat: { fullscreenRequired: false },
      },
    },
    constraints: {
      minQuestions: 5,
      maxQuestions: 20,
      allowedQuestionTypes: [EvaluationType.QCM, EvaluationType.TRUE_FALSE],
    },
    recommendations: {
      questionCount: 10,
      timePerQuestion: 1.5,
      tips: [
        "2 tentatives autorisées",
        "Note informative (ne compte pas pour la moyenne)",
        "Feedback détaillé pour identifier les lacunes",
      ],
    },
  },

  {
    id: "graded-exam",
    type: ExamType.EXAM,
    name: "Examen noté",
    description: "Examen officiel avec note comptant pour la moyenne",
    icon: "📋",
    defaultConfig: {
      evaluationType: EvaluationType.MIXED,
      pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
      learningMode: LearningMode.EXAM,
      duration: 60,
      passingScore: 50,
      config: {
        showResultsImmediately: false, // Correction différée
        allowReview: false,
        maxAttempts: 1,
        enableImmediateFeedback: false,
        antiCheat: {
          fullscreenRequired: true,
          disableCopyPaste: true,
          trackTabSwitches: true,
          maxTabSwitches: 3,
        },
      },
    },
    constraints: {
      minQuestions: 10,
      maxQuestions: 50,
      allowedQuestionTypes: [
        EvaluationType.QCM,
        EvaluationType.OPEN_QUESTION,
        EvaluationType.MIXED,
      ],
    },
    recommendations: {
      questionCount: 25,
      timePerQuestion: 2.5,
      tips: [
        "Une seule tentative",
        "Anti-triche activé",
        "Résultats différés pour éviter la triche",
        "Note compte pour la moyenne",
      ],
    },
  },

  {
    id: "competition",
    type: ExamType.COMPETITION,
    name: "Compétition",
    description: "Challenge gamifié avec classement en temps réel",
    icon: "🏆",
    defaultConfig: {
      evaluationType: EvaluationType.QCM,
      pedagogicalObjective: PedagogicalObjective.TRAIN,
      learningMode: LearningMode.COMPETITION,
      duration: 10, // Rapide
      config: {
        showResultsImmediately: true, // Classement live
        allowReview: true,
        maxAttempts: 1,
        enableImmediateFeedback: false, // Après la fin
        antiCheat: {
          fullscreenRequired: true,
          trackTabSwitches: true,
        },
      },
    },
    constraints: {
      minQuestions: 10,
      maxQuestions: 20,
      allowedQuestionTypes: [EvaluationType.QCM, EvaluationType.TRUE_FALSE],
    },
    recommendations: {
      questionCount: 15,
      timePerQuestion: 0.67, // 40s par question
      tips: [
        "Questions rapides (QCM)",
        "Classement en temps réel",
        "Gamification avec badges",
        "Temps limité pour l'intensité",
      ],
    },
  },
];
```

---

## 🏗️ Implémentation des patterns

### 1. ExamBuilder (Builder Pattern)

```typescript
/**
 * Builder pour construire progressivement un examen
 * avec validation à chaque étape
 */
export class ExamBuilder {
  private exam: Partial<IExam> = {
    status: ExamStatus.DRAFT,
    isPublished: false,
    isActive: true,
  };

  private validationErrors: string[] = [];
  private completedSteps: Set<string> = new Set();

  /**
   * Étape 1 : Définir le type d'examen
   */
  setType(examType: ExamType): this {
    const template = TEMPLATES.find((t) => t.type === examType);
    if (!template) {
      throw new Error(`Template inconnu : ${examType}`);
    }

    // Appliquer la config par défaut du template
    this.exam.evaluationType = template.defaultConfig.evaluationType;
    this.exam.pedagogicalObjective =
      template.defaultConfig.pedagogicalObjective;
    this.exam.learningMode = template.defaultConfig.learningMode;
    this.exam.duration = template.defaultConfig.duration;
    this.exam.config = template.defaultConfig.config as ExamConfig;

    this.completedSteps.add("type");
    return this;
  }

  /**
   * Étape 2 : Définir le contexte (école + classe)
   */
  async setContext(options: {
    schoolId?: string;
    classId?: string;
    targetLevelIds: string[];
  }): Promise<this> {
    // Validation : école-cycles-niveaux
    if (options.schoolId) {
      const isValid = await ContextValidator.validate({
        schoolId: options.schoolId,
        targetLevelIds: options.targetLevelIds,
      });

      if (!isValid.valid) {
        this.validationErrors.push(...isValid.errors);
        throw new Error("Contexte invalide");
      }

      // Déduire le schoolType
      const school = await School.findById(options.schoolId);
      this.exam.schoolType = school.type;
    } else {
      // Mode classe libre → déduire depuis les niveaux
      this.exam.schoolType = await deduceSchoolTypeFromLevels(
        options.targetLevelIds,
      );
    }

    this.exam.targetLevels = options.targetLevelIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    this.completedSteps.add("context");
    return this;
  }

  /**
   * Étape 3 : Définir la cible pédagogique
   */
  async setTarget(options: {
    subjectId: string;
    syllabusId?: string;
    linkedConcepts?: string[];
  }): Promise<this> {
    this.exam.subject = new mongoose.Types.ObjectId(options.subjectId);

    if (options.syllabusId) {
      this.exam.syllabus = new mongoose.Types.ObjectId(options.syllabusId);

      // Vérifier cohérence syllabus ↔ subject
      const syllabus = await Syllabus.findById(options.syllabusId);
      if (syllabus.subject.toString() !== options.subjectId) {
        this.validationErrors.push(
          "Le syllabus ne correspond pas à la matière",
        );
      }

      // Suggérer des concepts si non fournis
      if (!options.linkedConcepts) {
        const suggested = await getSuggestedConceptsFromSyllabus(
          options.syllabusId,
        );
        // Stocké pour suggestion UI, pas forcé
      }
    }

    if (options.linkedConcepts) {
      this.exam.linkedConcepts = options.linkedConcepts.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }

    this.completedSteps.add("target");
    return this;
  }

  /**
   * Étape 4 : Configurer les détails
   */
  setTiming(options: {
    startTime: Date;
    endTime: Date;
    duration?: number;
    closeMode?: CloseMode;
  }): this {
    this.exam.startTime = options.startTime;
    this.exam.endTime = options.endTime;

    if (options.duration) {
      this.exam.duration = options.duration;
    }

    this.exam.closeMode = options.closeMode || CloseMode.STRICT;

    this.completedSteps.add("timing");
    return this;
  }

  /**
   * Étape 5 : Personnaliser la configuration (optionnel)
   */
  customizeConfig(config: Partial<ExamConfig>): this {
    this.exam.config = {
      ...this.exam.config,
      ...config,
    };
    return this;
  }

  /**
   * Validation complète avant construction
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [...this.validationErrors];
    const warnings: string[] = [];

    // Vérifier que toutes les étapes obligatoires sont complétées
    const requiredSteps = ["type", "context", "target", "timing"];
    const missing = requiredSteps.filter((s) => !this.completedSteps.has(s));

    if (missing.length > 0) {
      errors.push(`Étapes manquantes : ${missing.join(", ")}`);
    }

    // Validation via les stratégies
    if (this.exam.schoolType && this.exam.targetLevels) {
      const strategy = getSchoolTypeStrategy(this.exam.schoolType);
      const strategyValidation = strategy.validateExam({
        duration: this.exam.duration!,
        questionCount: 0, // Sera validé après ajout des questions
        evaluationType: this.exam.evaluationType!,
        passingScore: this.exam.config?.passingScore || 0,
        targetLevelIds: this.exam.targetLevels.map((id) => id.toString()),
        subjectId: this.exam.subject?.toString(),
      });

      errors.push(...strategyValidation.errors);
      warnings.push(...strategyValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Construire l'examen final
   */
  async build(createdById: string): Promise<IExam> {
    const validation = await this.validate();

    if (!validation.isValid) {
      throw new Error(`Validation échouée : ${validation.errors.join(", ")}`);
    }

    // Créer l'examen
    const Exam = mongoose.model<IExam>("Exam");
    const exam = await Exam.create({
      ...this.exam,
      createdById,
      stats: {
        totalAttempts: 0,
        totalCompletions: 0,
        averageScore: 0,
        averageTime: 0,
        passRate: 0,
      },
    });

    return exam;
  }

  /**
   * Sauvegarder un brouillon
   */
  async saveDraft(createdById: string): Promise<IExam> {
    const Exam = mongoose.model<IExam>("Exam");

    // Ne pas valider complètement, juste sauvegarder l'état actuel
    const exam = await Exam.create({
      ...this.exam,
      createdById,
      status: ExamStatus.DRAFT,
      stats: {
        totalAttempts: 0,
        totalCompletions: 0,
        averageScore: 0,
        averageTime: 0,
        passRate: 0,
      },
    });

    return exam;
  }
}
```

---

### 2. ExamBuilderFactory (Factory Pattern)

```typescript
/**
 * Factory pour créer des builders préconfigurés
 */
export class ExamBuilderFactory {
  /**
   * Créer un builder depuis un template
   */
  static fromTemplate(examType: ExamType): ExamBuilder {
    const builder = new ExamBuilder();
    builder.setType(examType);
    return builder;
  }

  /**
   * Créer un builder depuis un brouillon existant
   */
  static async fromDraft(examId: string): Promise<ExamBuilder> {
    const exam = await Exam.findById(examId);
    if (!exam) {
      throw new Error(`Examen ${examId} introuvable`);
    }

    if (exam.status !== ExamStatus.DRAFT) {
      throw new Error("Seuls les brouillons peuvent être édités");
    }

    const builder = new ExamBuilder();
    // Restaurer l'état du builder depuis l'examen
    // ... (à implémenter)

    return builder;
  }

  /**
   * Raccourcis pour les types courants
   */
  static selfAssessment(): ExamBuilder {
    return this.fromTemplate(ExamType.SELF_ASSESSMENT);
  }

  static formativeQuiz(): ExamBuilder {
    return this.fromTemplate(ExamType.FORMATIVE_QUIZ);
  }

  static gradedExam(): ExamBuilder {
    return this.fromTemplate(ExamType.EXAM);
  }

  static competition(): ExamBuilder {
    return this.fromTemplate(ExamType.COMPETITION);
  }
}
```

---

### 3. ContextValidator

```typescript
/**
 * Valide la cohérence école-cycles-niveaux
 */
export class ContextValidator {
  static async validate(options: {
    schoolId: string;
    targetLevelIds: string[];
  }): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const school = await School.findById(options.schoolId);
    if (!school) {
      errors.push("École introuvable");
      return { valid: false, errors, warnings };
    }

    // Vérifier chaque niveau
    for (const levelId of options.targetLevelIds) {
      const level = await EducationLevel.findById(levelId);
      if (!level) {
        errors.push(`Niveau ${levelId} introuvable`);
        continue;
      }

      // Vérifier compatibilité avec le type d'école
      const strategy = getSchoolTypeStrategy(school.type);
      const isCompatible = await strategy.isEducationLevelCompatible(
        levelId,
        school.cycles, // 🆕 Prise en compte des cycles
      );

      if (!isCompatible) {
        if (school.cycles && school.cycles.length > 0) {
          errors.push(
            `Le niveau "${level.name}" (cycle ${level.cycle}) n'est pas enseigné dans cette école (cycles: ${school.cycles.join(", ")})`,
          );
        } else {
          errors.push(
            `Le niveau "${level.name}" n'est pas compatible avec le type d'école ${school.type}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

---

## 🔄 Workflow complet

```typescript
/**
 * Exemple d'utilisation : Créer un examen
 */
async function createExam() {
  // 1. Créer un builder depuis un template
  const builder = ExamBuilderFactory.gradedExam();

  // 2. Définir le contexte
  await builder.setContext({
    schoolId: "507f1f77bcf86cd799439011",
    targetLevelIds: ["507f191e810c19729de860ea"], // Terminale C
  });

  // 3. Définir la cible
  await builder.setTarget({
    subjectId: "507f191e810c19729de860eb", // Mathématiques
    syllabusId: "507f191e810c19729de860ec", // Syllabus Tle C
    linkedConcepts: ["intégrales", "dérivées", "limites"],
  });

  // 4. Configurer le timing
  builder.setTiming({
    startTime: new Date("2026-05-15T08:00:00Z"),
    endTime: new Date("2026-05-15T10:00:00Z"),
    duration: 120, // 2 heures
    closeMode: CloseMode.STRICT,
  });

  // 5. (Optionnel) Personnaliser la configuration
  builder.customizeConfig({
    antiCheat: {
      ...builder.exam.config.antiCheat,
      webcamRequired: true, // Activer la webcam
    },
  });

  // 6. Valider
  const validation = await builder.validate();
  if (!validation.isValid) {
    console.error("Erreurs :", validation.errors);
    return;
  }

  // 7. Construire et sauvegarder
  const exam = await builder.build(userId);

  console.log("✅ Examen créé :", exam._id);
}
```

---

## 🎯 API Routes V4

### POST /api/exams/v4/templates

```typescript
/**
 * Lister les templates disponibles
 */
export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    data: TEMPLATES,
  });
}
```

### POST /api/exams/v4/initialize

```typescript
/**
 * Initialiser un examen depuis un template
 */
export async function POST(req: Request) {
  const { templateId } = await req.json();

  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json(
      { success: false, message: "Template introuvable" },
      { status: 404 },
    );
  }

  const builder = ExamBuilderFactory.fromTemplate(template.type);
  const draft = await builder.saveDraft(session.user.id);

  return NextResponse.json({
    success: true,
    data: {
      examId: draft._id,
      template,
      nextStep: "context",
    },
  });
}
```

### PUT /api/exams/v4/:id/step

```typescript
/**
 * Compléter une étape du workflow
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { step, data } = await req.json();

  const builder = await ExamBuilderFactory.fromDraft(params.id);

  switch (step) {
    case "context":
      await builder.setContext(data);
      break;
    case "target":
      await builder.setTarget(data);
      break;
    case "timing":
      builder.setTiming(data);
      break;
    default:
      return NextResponse.json(
        { success: false, message: `Étape inconnue : ${step}` },
        { status: 400 },
      );
  }

  // Sauvegarder le brouillon mis à jour
  const draft = await builder.saveDraft(session.user.id);

  // Valider l'état actuel
  const validation = await builder.validate();

  return NextResponse.json({
    success: true,
    data: {
      exam: draft,
      validation,
      completedSteps: Array.from(builder.completedSteps),
      nextStep: getNextStep(builder.completedSteps),
    },
  });
}
```

---

## 📱 UI Wizard (Frontend)

```tsx
/**
 * Wizard de création d'examen
 */
function ExamCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [examId, setExamId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const steps = [
    { id: "type", label: "Type d'évaluation", component: TypeSelector },
    { id: "context", label: "Contexte", component: ContextSelector },
    { id: "target", label: "Cible pédagogique", component: TargetSelector },
    { id: "timing", label: "Configuration", component: TimingSelector },
    { id: "questions", label: "Questions", component: QuestionEditor },
    { id: "review", label: "Révision", component: ReviewStep },
  ];

  const handleStepComplete = async (stepId: string, data: any) => {
    const response = await fetch(`/api/exams/v4/${examId}/step`, {
      method: "PUT",
      body: JSON.stringify({ step: stepId, data }),
    });

    const result = await response.json();
    setValidation(result.data.validation);

    if (result.data.validation.isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <WizardContainer>
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Auto-save indicator */}
      <AutoSaveIndicator />

      {/* Validation warnings */}
      {validation && validation.warnings.length > 0 && (
        <WarningBanner warnings={validation.warnings} />
      )}

      {/* Current step component */}
      {React.createElement(steps[currentStep].component, {
        examId,
        onComplete: (data) => handleStepComplete(steps[currentStep].id, data),
      })}
    </WizardContainer>
  );
}
```

---

## ✅ Avantages de cette architecture

### 1. **Guidage intelligent**

- Workflow étape par étape avec validation
- Templates préconfigurés pour les cas courants
- Suggestions contextuelles

### 2. **Cohérence garantie**

- Validation école-cycles-niveaux
- Configuration cohérente selon le type d'évaluation
- Détection des incohérences en temps réel

### 3. **Extensibilité**

- Facile d'ajouter de nouveaux types d'examen
- Nouveaux templates sans changer le code
- Stratégies pluggables

### 4. **Expérience utilisateur**

- Sauvegarde automatique (brouillons)
- Pas de perte de données
- Feedback immédiat

### 5. **Maintenabilité**

- Séparation claire des responsabilités
- Patterns de conception éprouvés
- Code testable

---

## 🚀 Plan de migration

### Phase 1 : Infrastructure (1 semaine)

- ✅ Créer les enums et interfaces
- ✅ Implémenter ExamBuilder
- ✅ Implémenter ExamBuilderFactory
- ✅ Créer les templates

### Phase 2 : Backend (1 semaine)

- ✅ API routes V4
- ✅ ContextValidator
- ✅ Système de brouillons
- ✅ Migration de données

### Phase 3 : Frontend (2 semaines)

- ✅ Wizard UI
- ✅ Composants d'étapes
- ✅ Auto-save
- ✅ Validation temps réel

### Phase 4 : Tests & Optimisation (1 semaine)

- ✅ Tests unitaires
- ✅ Tests d'intégration
- ✅ Optimisation performances
- ✅ Documentation

---

**Total : ~5 semaines pour une migration complète**

Voulez-vous que je commence l'implémentation ?
