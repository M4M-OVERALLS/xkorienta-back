import EducationLevel from "@/models/EducationLevel";
import { SchoolType } from "@/models/School";
import { Cycle, EvaluationType } from "@/models/enums";
import {
  ExamDefaultConfig,
  ExamValidationInput,
  FeatureAvailability,
  ISchoolTypeStrategy,
  LevelTerminology,
  ValidationConstraints,
  ValidationResult,
} from "./ISchoolTypeStrategy";

/**
 * Stratégie pour les examens d'école secondaire (Collège + Lycée)
 *
 * Caractéristiques :
 * - Examens de durée moyenne à longue (30-180 min)
 * - Tous types d'évaluation disponibles (QCM, ouvertes, adaptatives, simulations)
 * - Préparation aux examens nationaux (BEPC, Baccalauréat)
 * - Évaluations plus rigoureuses
 * - Intégration avec le système de notation officiel
 * - Terminologie formelle (élève, examen, dissertation, épreuve)
 */
export class SecondaryExamStrategy implements ISchoolTypeStrategy {
  readonly schoolType = SchoolType.SECONDARY;
  readonly levelName = "École Secondaire";

  /**
   * Configuration par défaut pour le secondaire
   * - Durée moyenne (90 min par défaut)
   * - Nombre modéré de questions (20-25)
   * - Note de passage standard (50%)
   * - Tous types d'évaluation disponibles
   */
  getDefaultConfig(): ExamDefaultConfig {
    return {
      defaultDuration: 90,
      minDuration: 30,
      maxDuration: 240,
      passingScore: 50,
      recommendedQuestionCount: 25,
      minQuestions: 10,
      maxQuestions: 60,
      shuffleByDefault: true,
      showResultsImmediately: false, // Correction différée comme aux examens officiels
      allowReview: true,
      allowedEvaluationTypes: [
        EvaluationType.QCM,
        EvaluationType.OPEN_QUESTION,
        EvaluationType.ADAPTIVE,
        EvaluationType.EXAM_SIMULATION,
      ],
    };
  }

  /**
   * Contraintes de validation pour le secondaire
   * - QCM avec 2-6 réponses (plus de choix qu'au primaire)
   * - Questions ouvertes moyennes à longues (dissertations possibles)
   * - Examens adaptatifs autorisés
   * - Plusieurs matières possibles dans un même examen
   */
  getValidationConstraints(): ValidationConstraints {
    return {
      minAnswersPerQCM: 2,
      maxAnswersPerQCM: 6,
      minOpenQuestionLength: 20,
      maxOpenQuestionLength: 5000, // Dissertations longues autorisées
      allowMultipleChoice: true,
      allowOpenQuestions: true,
      allowAdaptiveExams: true,
      allowExamSimulation: true,
      minConcepts: 2,
      maxSingleSubjectPercentage: 80, // Examens pluridisciplinaires possibles
    };
  }

  /**
   * Terminologie formelle pour le secondaire
   * - Vocabulaire académique et officiel
   * - "Examen", "Épreuve", "Dissertation"
   * - Notation sur 20 (système camerounais et francophone)
   * - Références aux examens officiels (BEPC, Probatoire, Baccalauréat)
   */
  getTerminology(): LevelTerminology {
    return {
      examLabel: "Examen",
      testLabel: "Test",
      evaluationLabel: "Épreuve",
      gradeLabel: "Note",
      studentLabel: "Élève",
      teacherLabel: "Professeur",
      subjectLabel: "Matière / Discipline",
      classLabel: "Classe",
      cohortLabel: "Promotion",
      gradingScale: "sur 20",
      gradingScaleDescription:
        "Notation sur 20 (0-8.99 = insuffisant, 9-11.99 = passable, 12-13.99 = assez bien, 14-15.99 = bien, 16-20 = très bien)",
    };
  }

  /**
   * Fonctionnalités complètes pour le secondaire
   * - Export des résultats pour le bulletin
   * - Intégration avec le système de notation
   * - Statistiques avancées
   * - Certifications possibles (attestations de réussite)
   */
  getFeatureAvailability(): FeatureAvailability {
    return {
      qrCodeAccess: true,
      preExamReview: true,
      advancedStats: true,
      conceptAnalysis: true,
      classComparison: true,
      personalizedRecommendations: true,
      resultsExport: true, // Export pour bulletins
      gradingSystemIntegration: true,
      certification: true, // Attestations de réussite
      plagiarismDetection: false, // Pas encore nécessaire (réservé au supérieur)
      proctoredSessions: false,
    };
  }

  /**
   * Validation adaptée au secondaire
   * - Examens de durée variable selon le type
   * - Contrôles courts (30-60 min) ou examens longs (120-240 min)
   * - Tous types d'évaluation autorisés
   */
  validateExam(input: ExamValidationInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const constraints = this.getValidationConstraints();
    const config = this.getDefaultConfig();

    // 1. Validation de la durée
    if (input.duration < config.minDuration) {
      errors.push(
        `La durée minimale pour un examen de secondaire est de ${config.minDuration} minutes.`,
      );
    }
    if (input.duration > config.maxDuration) {
      warnings.push(
        `La durée de ${input.duration} minutes est exceptionnellement longue. Assurez-vous que cela correspond bien à un examen officiel (type Baccalauréat).`,
      );
    }

    // 2. Validation du nombre de questions
    if (input.questionCount < config.minQuestions) {
      errors.push(
        `Un examen doit avoir au moins ${config.minQuestions} questions.`,
      );
    }
    if (input.questionCount > config.maxQuestions) {
      warnings.push(
        `${input.questionCount} questions est un nombre très élevé. Vérifiez que la durée de l'examen est suffisante.`,
      );
    }

    // 3. Validation du type d'évaluation
    if (!config.allowedEvaluationTypes.includes(input.evaluationType)) {
      errors.push(
        `Le type d'évaluation "${input.evaluationType}" n'est pas autorisé pour le secondaire.`,
      );
    }

    // 4. Cohérence durée/nombre de questions
    const avgTimePerQuestion = input.duration / input.questionCount;

    if (input.evaluationType === EvaluationType.QCM && avgTimePerQuestion < 1) {
      warnings.push(
        `Temps moyen par question (${avgTimePerQuestion.toFixed(1)} min) très court pour un QCM. Recommandé : 1.5-3 minutes par question.`,
      );
    }

    if (
      input.evaluationType === EvaluationType.OPEN_QUESTION &&
      avgTimePerQuestion < 5
    ) {
      warnings.push(
        `Temps moyen par question (${avgTimePerQuestion.toFixed(1)} min) peut être insuffisant pour des questions ouvertes. Recommandé : 10-20 minutes par question.`,
      );
    }

    // 5. Validation de la note de passage
    if (input.passingScore < 40) {
      warnings.push(
        "Une note de passage inférieure à 40% (8/20) est en dessous des standards académiques.",
      );
    }
    if (input.passingScore > 60) {
      warnings.push(
        "Une note de passage supérieure à 60% (12/20) est exigeante. Assurez-vous que cela correspond à vos critères.",
      );
    }

    // 6. Validation des niveaux ciblés
    if (!input.targetLevelIds || input.targetLevelIds.length === 0) {
      errors.push(
        "Vous devez sélectionner au moins un niveau (6ème à Terminale).",
      );
    }

    // 7. Validation des concepts
    if (input.concepts && input.concepts.length < constraints.minConcepts) {
      warnings.push(
        `Il est recommandé d'évaluer au moins ${constraints.minConcepts} concepts pour un examen de secondaire.`,
      );
    }

    // 8. Validation de la matière (recommandée)
    if (!input.subjectId) {
      warnings.push(
        "Il est recommandé de spécifier une matière pour un examen de secondaire.",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calcul de difficulté pour le secondaire
   * - Difficulté moyenne à élevée
   * - Base : 50-70 (moyen à difficile)
   * - Ajustement selon le cycle (collège vs lycée)
   */
  calculateRecommendedDifficulty(
    targetLevelIds: string[],
    conceptCount: number,
  ): number {
    // Base : 55 (moyen)
    let difficulty = 55;

    // Ajustement selon le nombre de concepts (max +25)
    const conceptBonus = Math.min(conceptCount * 4, 25);
    difficulty += conceptBonus;

    // Ajustement selon le nombre de niveaux ciblés (multi-niveaux = plus complexe)
    if (targetLevelIds.length > 2) {
      difficulty += 15;
    }

    // Plafonner à 90 pour le secondaire
    return Math.min(difficulty, 90);
  }

  /**
   * Suggestions de configuration selon le type d'évaluation
   */
  getConfigSuggestions(evaluationType: EvaluationType): {
    duration: number;
    questionCount: number;
    passingScore: number;
    rationale: string;
  } {
    switch (evaluationType) {
      case EvaluationType.QCM:
        return {
          duration: 60,
          questionCount: 30,
          passingScore: 50,
          rationale:
            "QCM pour le secondaire : 30 questions en 60 minutes. Les élèves ont environ 2 minutes par question.",
        };

      case EvaluationType.OPEN_QUESTION:
        return {
          duration: 120,
          questionCount: 8,
          passingScore: 50,
          rationale:
            "Questions ouvertes type dissertation : 8 questions en 2 heures. Les élèves ont environ 15 minutes par question pour rédiger.",
        };

      case EvaluationType.ADAPTIVE:
        return {
          duration: 90,
          questionCount: 25,
          passingScore: 55,
          rationale:
            "Examen adaptatif : 25 questions en 90 minutes. La difficulté s'adapte au niveau de l'élève. Note de passage légèrement plus élevée (55%).",
        };

      case EvaluationType.EXAM_SIMULATION:
        return {
          duration: 180,
          questionCount: 40,
          passingScore: 50,
          rationale:
            "Simulation d'examen officiel (type BEPC/Bac) : 40 questions mixtes en 3 heures. Format proche des épreuves officielles.",
        };

      default:
        return {
          duration: 90,
          questionCount: 25,
          passingScore: 50,
          rationale: "Configuration par défaut pour le secondaire.",
        };
    }
  }

  /**
   * Vérifier la compatibilité d'un niveau éducatif avec ce type d'école
   * Compatible avec : COLLEGE, LYCEE
   *
   * @param educationLevelId - ID du niveau éducatif
   * @param schoolCycles - Cycles effectivement enseignés dans l'école (optionnel)
   * @returns true si compatible, false sinon
   *
   * Exemples :
   * - École SECONDARY avec cycles [COLLEGE, LYCEE] : accepte 6ème → Terminale
   * - École SECONDARY avec cycles [COLLEGE] : accepte seulement 6ème → 3ème
   * - École SECONDARY avec cycles [LYCEE] : accepte seulement 2nde → Terminale
   */
  async isEducationLevelCompatible(
    educationLevelId: string,
    schoolCycles?: Cycle[],
  ): Promise<boolean> {
    try {
      const level = await EducationLevel.findById(educationLevelId);
      if (!level) return false;

      // Vérifier que le niveau est COLLEGE ou LYCEE
      if (
        ![
          Cycle.SECONDAIRE_PREMIER_CYCLE,
          Cycle.SECONDAIRE_SECOND_CYCLE,
        ].includes(level.cycle)
      ) {
        return false;
      }

      // Si l'école précise ses cycles, vérifier la compatibilité fine
      if (schoolCycles && schoolCycles.length > 0) {
        return schoolCycles.includes(level.cycle);
      }

      // Sinon, compatible par défaut avec tous les cycles SECONDARY
      return true;
    } catch (error) {
      console.error("Erreur lors de la vérification de compatibilité:", error);
      return false;
    }
  }

  /**
   * Obtenir les niveaux éducatifs recommandés (6ème à Terminale)
   */
  async getRecommendedEducationLevels(): Promise<string[]> {
    try {
      const levels = await EducationLevel.find({
        cycle: {
          $in: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
        },
      }).select("_id");

      return levels.map((level) => level._id.toString());
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des niveaux recommandés:",
        error,
      );
      return [];
    }
  }
}

/**
 * Instance singleton pour usage global
 */
export const secondaryExamStrategy = new SecondaryExamStrategy();
