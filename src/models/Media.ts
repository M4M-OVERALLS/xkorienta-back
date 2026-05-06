import mongoose, { Document, Model, Schema } from "mongoose";
import { DifficultyLevel, MediaScope, MediaStatus, MediaType } from "./enums";

export interface IMedia extends Document {
  _id: mongoose.Types.ObjectId;
  /** Discriminant : VIDEO | PODCAST | AUDIO */
  mediaType: MediaType;
  title: string;
  description: string;
  /** Clé opaque dans le stockage (local ou S3) */
  fileKey: string;
  /** MIME type détecté à l'upload */
  mimeType: string;
  /** Taille du fichier en octets */
  fileSize: number;
  /** Durée en secondes (vidéo / audio / podcast) */
  duration?: number;
  /** Clé de l'image de couverture dans public/uploads/covers/ */
  coverImageKey?: string;
  price: number;
  currency: string;
  scope: MediaScope;
  schoolId?: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  status: MediaStatus;
  validatedBy?: mongoose.Types.ObjectId;
  validationComment?: string;
  validatedAt?: Date;
  copyrightAccepted: boolean;
  /** Nombre de fois que le media a été écouté / regardé */
  playCount: number;
  /** Nombre d'achats complétés */
  purchaseCount: number;

  // Métadonnées pédagogiques (système de recommandation IA)
  /** Niveaux scolaires ciblés (EducationLevel) */
  targetLevels?: mongoose.Types.ObjectId[];
  /** Filières ciblées (Field) */
  targetFields?: mongoose.Types.ObjectId[];
  /** Matières couvertes (Subject) */
  subjects?: mongoose.Types.ObjectId[];
  /** Niveau de difficulté du contenu */
  difficulty?: DifficultyLevel;
  /** Tags libres pour enrichir le matching sémantique */
  tags?: string[];

  // Métadonnées spécifiques au podcast
  seriesTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    mediaType: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    fileKey: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      min: 0,
    },
    coverImageKey: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "XAF",
      trim: true,
      uppercase: true,
    },
    scope: {
      type: String,
      enum: Object.values(MediaScope),
      required: true,
      default: MediaScope.GLOBAL,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MediaStatus),
      default: MediaStatus.PENDING,
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    validationComment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    validatedAt: {
      type: Date,
    },
    copyrightAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Métadonnées pédagogiques (recommandation IA)
    targetLevels: [{ type: Schema.Types.ObjectId, ref: "EducationLevel" }],
    targetFields: [{ type: Schema.Types.ObjectId, ref: "Field" }],
    subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    difficulty: {
      type: String,
      enum: Object.values(DifficultyLevel),
    },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],

    // Podcast
    seriesTitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    episodeNumber: {
      type: Number,
      min: 1,
    },
    seasonNumber: {
      type: Number,
      min: 1,
    },
  },
  { timestamps: true },
);

// Index catalogue public : type + statut + scope
MediaSchema.index({ mediaType: 1, status: 1, scope: 1 });
MediaSchema.index({ status: 1, scope: 1, createdAt: -1 });
MediaSchema.index({ submittedBy: 1 });
MediaSchema.index({ schoolId: 1, status: 1 });
MediaSchema.index({ price: 1, status: 1 });
MediaSchema.index({ title: "text", description: "text", seriesTitle: "text" });
// Index recommandation IA : éviter les index composés sur plusieurs tableaux (MongoDB limitation)
MediaSchema.index({ targetLevels: 1, status: 1 });
MediaSchema.index({ targetFields: 1, status: 1 });
MediaSchema.index({ subjects: 1, status: 1 });
MediaSchema.index({ tags: 1 });

const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);

export default Media;
