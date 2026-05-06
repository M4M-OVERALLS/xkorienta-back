import mongoose, { Schema, Document, Model } from "mongoose";
import { MediaInteractionType } from "./enums";

export interface IMediaInteraction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  mediaId: mongoose.Types.ObjectId;
  eventType: MediaInteractionType;
  /** Pourcentage de contenu consommé (0-100) */
  completionRate?: number;
  /** Note de l'utilisateur (1-5) — futur */
  rating?: number;
  /** Durée de la session en secondes */
  sessionDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MediaInteractionSchema = new Schema<IMediaInteraction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
    eventType: {
      type: String,
      enum: Object.values(MediaInteractionType),
      required: true,
    },
    completionRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    sessionDuration: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
);

MediaInteractionSchema.index({ userId: 1, mediaId: 1, eventType: 1 });
MediaInteractionSchema.index({ mediaId: 1, eventType: 1 });
MediaInteractionSchema.index({ userId: 1, createdAt: -1 });

const MediaInteraction: Model<IMediaInteraction> =
  mongoose.models.MediaInteraction ||
  mongoose.model<IMediaInteraction>("MediaInteraction", MediaInteractionSchema);

export default MediaInteraction;
