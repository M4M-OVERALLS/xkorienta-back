import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Interface pour les statistiques d'une option
 * Permet d'analyser les patterns de sélection
 */
export interface OptionStats {
  timesSelected: number // Nombre de fois que l'option a été sélectionnée
  selectionRate: number // Taux de sélection en pourcentage
}

/**
 * Interface principale du modèle Option V2
 *
 * @example
 * ```typescript
 * const option = await Option.create({
 *   questionId: question._id,
 *   text: "2x",
 *   isCorrect: true,
 *   explanation: "C'est la bonne réponse car..."
 * })
 * ```
 */
export interface IOption extends Document {
  _id: mongoose.Types.ObjectId
  questionId: mongoose.Types.ObjectId

  // Contenu de l'option
  text: string
  imageUrl?: string // Pour les options avec image
  isCorrect: boolean

  // Aide pédagogique (NOUVEAUX CHAMPS V2)
  explanation?: string // Explication pourquoi cette option est correcte/incorrecte

  // Statistiques (NOUVEAUX CHAMPS V2 - denormalized)
  stats: OptionStats

  // Métadonnées
  order?: number // Ordre d'affichage (pour options non mélangées)
  createdAt: Date
  updatedAt: Date
}

const OptionSchema = new Schema<IOption>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true
    },

    // Contenu de l'option
    text: {
      type: String,
      required: true,
      trim: true
    },
    imageUrl: {
      type: String
    },
    isCorrect: {
      type: Boolean,
      default: false,
      required: true
    },

    // Aide pédagogique
    explanation: {
      type: String,
      trim: true
    },

    // Statistiques
    stats: {
      timesSelected: {
        type: Number,
        default: 0
      },
      selectionRate: {
        type: Number,
        default: 0
      }
    },

    // Métadonnées
    order: {
      type: Number
    }
  },
  {
    timestamps: true
  }
)

// SECURITY (A-10): Strip isCorrect from JSON serialization by default.
// Server-side scoring (AttemptService) uses .lean() which bypasses toJSON,
// so this only affects responses sent to clients.
OptionSchema.set('toJSON', {
  transform(_doc, ret) {
    const obj = ret as unknown as Record<string, unknown>
    delete obj.isCorrect
    return obj
  }
})

// Indexes
OptionSchema.index({ questionId: 1, order: 1 }) // Pour récupérer les options triées
OptionSchema.index({ questionId: 1, isCorrect: 1 }) // Pour trouver la bonne réponse rapidement

const Option: Model<IOption> = mongoose.models.Option || mongoose.model<IOption>('Option', OptionSchema)

export default Option
