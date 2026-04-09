import mongoose, { Document, Schema } from "mongoose";
import { DifficultyLevel, EvaluationType } from "./enums";

/**
 * Interface pour une option de réponse (QCM)
 */
export interface IQuestionOption {
  text: string;
  isCorrect: boolean;
  feedback?: string;
}

/**
 * Interface pour les statistiques d'utilisation d'une question
 */
export interface QuestionUsageStats {
  timesUsed: number; // Nombre d'examens utilisant cette question
  averageSuccessRate: number; // Taux de réussite moyen
  lastUsed?: Date;
}

/**
 * Interface pour une question de la banque
 * Banque de questions réutilisables pour créer des examens
 */
export interface IQuestionBank extends Document {
  _id: mongoose.Types.ObjectId;

  // Contenu de la question
  text: string;
  imageUrl?: string;
  audioUrl?: string;

  // Type et configuration
  type: EvaluationType; // QCM, TRUE_FALSE, SHORT_ANSWER, ESSAY, etc.
  points: number;
  difficulty: DifficultyLevel;

  // Réponses selon le type
  options?: IQuestionOption[]; // Pour QCM
  correctAnswer?: boolean; // Pour TRUE_FALSE
  modelAnswer?: string; // Pour ESSAY ou SHORT_ANSWER

  // Aide pédagogique
  explanation?: string;
  hints?: string[];
  tags?: string[];

  // Métadonnées pédagogiques
  subject: mongoose.Types.ObjectId; // Matière
  syllabus?: mongoose.Types.ObjectId; // Syllabus (optionnel)
  learningUnit?: mongoose.Types.ObjectId; // Chapitre/Unité d'apprentissage (optionnel)
  concepts?: mongoose.Types.ObjectId[]; // Concepts liés (optionnel)

  // Statistiques d'utilisation
  stats: QuestionUsageStats;

  // Auteur et visibilité
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean; // Visible par tous les enseignants ou seulement le créateur
  isValidated: boolean; // Validée par un administrateur

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

const QuestionBankSchema = new Schema<IQuestionBank>(
  {
    // Contenu de la question
    text: {
      type: String,
      required: true,
      trim: true,
      index: "text", // Index texte pour la recherche
    },
    imageUrl: {
      type: String,
    },
    audioUrl: {
      type: String,
    },

    // Type et configuration
    type: {
      type: String,
      enum: Object.values(EvaluationType),
      required: true,
      index: true,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    difficulty: {
      type: String,
      enum: Object.values(DifficultyLevel),
      required: true,
      index: true,
    },

    // Réponses selon le type
    options: [
      {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
        feedback: { type: String },
      },
    ],
    correctAnswer: {
      type: Boolean,
    },
    modelAnswer: {
      type: String,
    },

    // Aide pédagogique
    explanation: {
      type: String,
    },
    hints: [String],
    tags: [String],

    // Métadonnées pédagogiques
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    syllabus: {
      type: Schema.Types.ObjectId,
      ref: "Syllabus",
      index: true,
    },
    learningUnit: {
      type: Schema.Types.ObjectId,
      ref: "LearningUnit",
      index: true,
    },
    concepts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Concept",
      },
    ],

    // Statistiques d'utilisation
    stats: {
      timesUsed: {
        type: Number,
        default: 0,
      },
      averageSuccessRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      lastUsed: {
        type: Date,
      },
    },

    // Auteur et visibilité
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    isValidated: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index composés pour recherches optimisées
QuestionBankSchema.index({ subject: 1, difficulty: 1 });
QuestionBankSchema.index({ subject: 1, learningUnit: 1 });
QuestionBankSchema.index({ subject: 1, syllabus: 1, difficulty: 1 });
QuestionBankSchema.index({ createdBy: 1, isPublic: 1 });

// Méthodes d'instance

/**
 * Incrémenter le compteur d'utilisation
 */
QuestionBankSchema.methods.incrementUsage = async function () {
  this.stats.timesUsed += 1;
  this.stats.lastUsed = new Date();
  await this.save();
};

/**
 * Mettre à jour le taux de réussite moyen
 */
QuestionBankSchema.methods.updateSuccessRate = async function (
  newRate: number,
) {
  const currentAvg = this.stats.averageSuccessRate;
  const count = this.stats.timesUsed;

  // Moyenne pondérée
  this.stats.averageSuccessRate = (currentAvg * count + newRate) / (count + 1);

  await this.save();
};

// Exporter le modèle
const QuestionBank =
  (mongoose.models.QuestionBank as mongoose.Model<IQuestionBank>) ||
  mongoose.model<IQuestionBank>("QuestionBank", QuestionBankSchema);

export default QuestionBank;
