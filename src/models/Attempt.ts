import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Statut d'une tentative d'examen
 */
export enum AttemptStatus {
  STARTED = 'STARTED',     // Tentative démarrée
  COMPLETED = 'COMPLETED', // Tentative terminée et soumise
  EXPIRED = 'EXPIRED',     // Tentative expirée (temps écoulé)
  ABANDONED = 'ABANDONED'  // Tentative abandonnée par l'étudiant
}

/**
 * Type d'événement anti-triche
 */
export enum AntiCheatEventType {
  TAB_SWITCH = 'TAB_SWITCH',           // Changement d'onglet
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT', // Sortie du mode plein écran
  COPY_ATTEMPT = 'COPY_ATTEMPT',       // Tentative de copie
  PASTE_ATTEMPT = 'PASTE_ATTEMPT',     // Tentative de collage
  RIGHT_CLICK = 'RIGHT_CLICK',         // Clic droit
  BLUR_EVENT = 'BLUR_EVENT'            // Perte de focus
}

/**
 * Interface pour un événement anti-triche
 */
export interface AntiCheatEvent {
  type: AntiCheatEventType
  timestamp: Date
  metadata?: any // Données supplémentaires sur l'événement
}

/**
 * Interface principale du modèle Attempt V2
 *
 * @example
 * ```typescript
 * const attempt = await Attempt.create({
 *   examId: exam._id,
 *   userId: student._id,
 *   expiresAt: new Date(Date.now() + exam.duration * 60 * 1000),
 *   resumeToken: generateToken()
 * })
 * ```
 */
export interface IAttempt extends Document {
  _id: mongoose.Types.ObjectId
  examId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId

  // Temporalité
  startedAt: Date
  expiresAt: Date
  submittedAt?: Date
  pausedAt?: Date // Pour les examens avec pause autorisée

  // Statut
  status: AttemptStatus

  // Résultats
  score?: number
  maxScore?: number // Score maximum possible
  percentage?: number // Pourcentage de réussite
  passed?: boolean // A réussi l'examen (seuil de passage)

  // Sécurité et reprise
  resumeToken: string // Token unique pour reprendre la tentative

  // Anti-triche (NOUVEAUX CHAMPS V2)
  antiCheatEvents: AntiCheatEvent[]
  tabSwitchCount: number
  suspiciousActivityDetected: boolean

  // Temps passé (NOUVEAUX CHAMPS V2)
  timeSpent?: number // Temps total passé en minutes
  timeRemaining?: number // Temps restant en minutes

  // Métadonnées
  ipAddress?: string // Adresse IP de l'étudiant
  userAgent?: string // User agent du navigateur
  createdAt: Date
  updatedAt: Date
}

const AttemptSchema = new Schema<IAttempt>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Temporalité
    startedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
      // Note: TTL index is created below via schema.index()
    },
    submittedAt: {
      type: Date
    },
    pausedAt: {
      type: Date
    },

    // Statut
    status: {
      type: String,
      enum: Object.values(AttemptStatus),
      default: AttemptStatus.STARTED,
      index: true
    },

    // Résultats
    score: {
      type: Number,
      min: 0
    },
    maxScore: {
      type: Number,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    passed: {
      type: Boolean
    },

    // Sécurité et reprise
    resumeToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // Anti-triche
    antiCheatEvents: [
      {
        type: {
          type: String,
          enum: Object.values(AntiCheatEventType),
          required: true
        },
        timestamp: {
          type: Date,
          required: true
        },
        metadata: Schema.Types.Mixed
      }
    ],
    tabSwitchCount: {
      type: Number,
      default: 0
    },
    suspiciousActivityDetected: {
      type: Boolean,
      default: false
    },

    // Temps passé
    timeSpent: {
      type: Number,
      min: 0
    },
    timeRemaining: {
      type: Number,
      min: 0
    },

    // Métadonnées
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
)

// Indexes composés pour requêtes optimisées
AttemptSchema.index({ examId: 1, userId: 1 }) // Trouver les tentatives d'un étudiant pour un examen
AttemptSchema.index({ userId: 1, status: 1 }) // Trouver les tentatives d'un étudiant par statut
AttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }) // TTL: supprime après 24h

const Attempt: Model<IAttempt> = mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema)

export default Attempt
