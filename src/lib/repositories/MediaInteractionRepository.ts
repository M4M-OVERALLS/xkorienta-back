import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import MediaInteraction, {
  IMediaInteraction,
} from "@/models/MediaInteraction";
import { MediaInteractionType } from "@/models/enums";

export class MediaInteractionRepository {
  /**
   * Enregistre une interaction utilisateur-média.
   * Pour PLAY, crée une nouvelle entrée à chaque fois.
   * Pour COMPLETE/PURCHASE, upsert pour éviter les doublons.
   */
  async track(
    userId: string,
    mediaId: string,
    eventType: MediaInteractionType,
    extra?: {
      completionRate?: number;
      rating?: number;
      sessionDuration?: number;
    },
  ): Promise<IMediaInteraction> {
    await connectDB();

    if (eventType === MediaInteractionType.PLAY) {
      return MediaInteraction.create({
        userId: new mongoose.Types.ObjectId(userId),
        mediaId: new mongoose.Types.ObjectId(mediaId),
        eventType,
        ...extra,
      });
    }

    return MediaInteraction.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        mediaId: new mongoose.Types.ObjectId(mediaId),
        eventType,
      },
      {
        $set: { ...extra },
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          mediaId: new mongoose.Types.ObjectId(mediaId),
          eventType,
        },
      },
      { upsert: true, new: true },
    ) as Promise<IMediaInteraction>;
  }

  /**
   * Retourne les IDs des médias avec lesquels l'utilisateur a interagi
   * (pour exclusion dans les recommandations).
   */
  async getInteractedMediaIds(
    userId: string,
    eventTypes?: MediaInteractionType[],
  ): Promise<string[]> {
    await connectDB();

    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (eventTypes?.length) {
      filter.eventType = { $in: eventTypes };
    }

    const results = await MediaInteraction.distinct("mediaId", filter);
    return results.map((id: mongoose.Types.ObjectId) => id.toString());
  }

  /**
   * Comptage d'interactions par média (utilisé pour scoring popularité pondéré).
   */
  async getMediaInteractionCounts(
    mediaIds: string[],
    eventType: MediaInteractionType,
  ): Promise<Map<string, number>> {
    await connectDB();

    const pipeline = [
      {
        $match: {
          mediaId: {
            $in: mediaIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          eventType,
        },
      },
      { $group: { _id: "$mediaId", count: { $sum: 1 } } },
    ];

    const results = await MediaInteraction.aggregate(pipeline);
    const map = new Map<string, number>();
    for (const r of results) {
      map.set(r._id.toString(), r.count);
    }
    return map;
  }
}

export const mediaInteractionRepository = new MediaInteractionRepository();
