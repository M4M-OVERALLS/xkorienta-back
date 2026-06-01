import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Interface principale du modèle Response V2
 *
 * @example
 * ```typescript
 * const response = await Response.create({
 *   attemptId: attempt._id,
 *   questionId: question._id,
 *   selectedOptionId: option._id,
 *   isCorrect: true,
 *   timeSpent: 45 // 45 secondes
 * })
 * ```
 */
export interface IResponse extends Document {
  _id: mongoose.Types.ObjectId
  attemptId: mongoose.Types.ObjectId
  questionId: mongoose.Types.ObjectId
  selectedOptionId?: mongoose.Types.ObjectId // Optional pour questions non répondues
  textResponse?: string // NOUVEAU - Pour les questions ouvertes

  // Validation
  isCorrect: boolean
  partialScore?: number // Pour les questions à points partiels

  // Temps (NOUVEAUX CHAMPS V2)
  timeSpent?: number // Temps passé sur la question en secondes
  answeredAt?: Date // Timestamp de la réponse

  // Correction manuelle (questions ouvertes)
  gradingStatus?: 'pending' | 'graded'
  manualScore?: number       // Score donné par l'enseignant (0-100)
  teacherComment?: string    // Commentaire de l'enseignant
  gradedBy?: mongoose.Types.ObjectId  // ID de l'enseignant correcteur
  gradedAt?: Date

  // Métadonnées
  isMarkedForReview?: boolean // Étudiant a marqué pour révision
  createdAt: Date
  updatedAt: Date
}

const ResponseSchema = new Schema<IResponse>(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: 'Attempt',
      required: true,
      index: true
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true
    },
    selectedOptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Option'
    },
    textResponse: {
      type: String,
      trim: true
    },

    // Validation
    isCorrect: {
      type: Boolean,
      required: true,
      default: false
    },
    partialScore: {
      type: Number,
      min: 0
    },

    // Temps
    timeSpent: {
      type: Number,
      min: 0
    },
    answeredAt: {
      type: Date
    },

    // Correction manuelle
    gradingStatus: {
      type: String,
      enum: ['pending', 'graded'],
      default: 'pending'
    },
    manualScore: {
      type: Number,
      min: 0,
      max: 100
    },
    teacherComment: {
      type: String,
      trim: true
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: {
      type: Date
    },

    // Métadonnées
    isMarkedForReview: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

// Indexes
ResponseSchema.index({ attemptId: 1, questionId: 1 }, { unique: true }) // Une seule réponse par question par tentative
ResponseSchema.index({ questionId: 1, isCorrect: 1 }) // Stats par question

const Response: Model<IResponse> = mongoose.models.Response || mongoose.model<IResponse>('Response', ResponseSchema)

export default Response
