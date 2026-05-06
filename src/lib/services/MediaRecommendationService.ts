/**
 * MediaRecommendationService
 *
 * Moteur de recommandation IA pour la médiathèque.
 * Calcule un score de pertinence multi-critères pour chaque média
 * en fonction du profil apprenant (LearnerProfile).
 *
 * Signaux utilisés :
 * - Niveau scolaire (currentLevel)
 * - Filière (currentField)
 * - Matières faibles (weakSubjects) — priorité haute
 * - Profil cognitif → préférence de format (VISUAL→VIDEO, AUDITORY→PODCAST)
 * - Type d'apprenant → plage de difficulté recommandée
 * - Popularité normalisée (playCount)
 *
 * Algorithme : scoring heuristique pondéré + fallback gracieux.
 */

import mongoose from "mongoose";
import * as ss from "simple-statistics";
import connectDB from "@/lib/mongodb";
import Media, { IMedia } from "@/models/Media";
import MediaPurchase from "@/models/MediaPurchase";
import {
  CognitiveProfile,
  DifficultyLevel,
  LearnerType,
  MediaPurchaseStatus,
  MediaScope,
  MediaStatus,
  MediaType,
} from "@/models/enums";
import { ILearnerProfile } from "@/models/LearnerProfile";
import { LearnerProfileRepository } from "@/lib/repositories/LearnerProfileRepository";

// Poids du scoring (v1)
const WEIGHTS = {
  level: 0.3,
  field: 0.2,
  subject: 0.25,
  cognitive: 0.1,
  difficulty: 0.1,
  popularity: 0.05,
} as const;

// Correspondance profil cognitif → format préféré
const COGNITIVE_FORMAT_MAP: Record<CognitiveProfile, MediaType[]> = {
  [CognitiveProfile.VISUAL]: [MediaType.VIDEO],
  [CognitiveProfile.AUDITORY]: [MediaType.PODCAST, MediaType.AUDIO],
  [CognitiveProfile.LOGIC_MATH]: [],
  [CognitiveProfile.LITERARY]: [MediaType.AUDIO, MediaType.PODCAST],
};

// Correspondance type d'apprenant → plage de difficulté optimale
const LEARNER_DIFFICULTY_MAP: Record<LearnerType, DifficultyLevel[]> = {
  [LearnerType.REMEDIAL]: [DifficultyLevel.BEGINNER],
  [LearnerType.STRUGGLING]: [
    DifficultyLevel.BEGINNER,
    DifficultyLevel.INTERMEDIATE,
  ],
  [LearnerType.EXAM_PREP]: [
    DifficultyLevel.INTERMEDIATE,
    DifficultyLevel.ADVANCED,
  ],
  [LearnerType.ADVANCED]: [DifficultyLevel.ADVANCED, DifficultyLevel.EXPERT],
};

export interface RecommendationOptions {
  userId?: string;
  excludeMediaId?: string;
  limit?: number;
  /** IDs des écoles de l'utilisateur (pour filtrer scope SCHOOL) */
  userSchoolIds?: string[];
}

export interface RecommendationResult {
  items: (IMedia & { coverImageUrl?: string })[];
  personalized: boolean;
  fallback: boolean;
}

interface ScoredMedia {
  media: IMedia;
  score: number;
}

const learnerProfileRepo = new LearnerProfileRepository();

/** Cache in-memory simple (TTL 15 min) */
const recoCache = new Map<
  string,
  { data: RecommendationResult; expiresAt: number }
>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCacheKey(opts: RecommendationOptions): string {
  return `reco:${opts.userId ?? "anon"}:${opts.excludeMediaId ?? "none"}:${opts.limit ?? 4}`;
}

function getFromCache(key: string): RecommendationResult | null {
  const entry = recoCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    recoCache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key: string, data: RecommendationResult): void {
  recoCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidation ciblée par userId */
export function invalidateRecommendationCache(userId: string): void {
  for (const key of recoCache.keys()) {
    if (key.startsWith(`reco:${userId}:`)) {
      recoCache.delete(key);
    }
  }
}

export class MediaRecommendationService {
  /**
   * Point d'entrée principal.
   * Retourne les médias recommandés, personnalisés si authentifié.
   */
  async getRecommendations(
    opts: RecommendationOptions,
  ): Promise<RecommendationResult> {
    const cacheKey = getCacheKey(opts);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    await connectDB();

    const limit = Math.min(opts.limit ?? 4, 20);

    if (!opts.userId) {
      const result = await this.getPopularFallback(
        limit,
        opts.excludeMediaId,
      );
      setInCache(cacheKey, result);
      return result;
    }

    const profile = await learnerProfileRepo.findByUserId(opts.userId);
    if (!profile) {
      const result = await this.getPopularFallback(
        limit,
        opts.excludeMediaId,
      );
      setInCache(cacheKey, result);
      return result;
    }

    const result = await this.getPersonalizedRecommendations(
      profile,
      opts,
      limit,
    );
    setInCache(cacheKey, result);
    return result;
  }

  /**
   * Recommandations personnalisées via scoring multi-critères.
   */
  private async getPersonalizedRecommendations(
    profile: ILearnerProfile,
    opts: RecommendationOptions,
    limit: number,
  ): Promise<RecommendationResult> {
    const excludeIds = await this.getExcludedMediaIds(
      opts.userId!,
      opts.excludeMediaId,
    );

    const matchFilter = this.buildMatchFilter(
      excludeIds,
      opts.userSchoolIds,
    );

    const candidates = await Media.find(matchFilter)
      .populate("submittedBy", "name image")
      .select(
        "_id mediaType title description duration price currency playCount purchaseCount coverImageKey submittedBy targetLevels targetFields subjects difficulty tags createdAt seriesTitle episodeNumber seasonNumber",
      )
      .lean<IMedia[]>();

    if (candidates.length === 0) {
      return this.getPopularFallback(limit, opts.excludeMediaId);
    }

    const scored = this.scoreAndRank(candidates, profile);
    const diversified = this.ensureFormatDiversity(scored, limit);

    return {
      items: diversified,
      personalized: true,
      fallback: false,
    };
  }

  /**
   * Calcule le score de pertinence pour chaque média.
   */
  private scoreAndRank(
    candidates: IMedia[],
    profile: ILearnerProfile,
  ): ScoredMedia[] {
    const playCounts = candidates.map((m) => m.playCount ?? 0);
    const maxPlay = playCounts.length > 0 ? Math.max(...playCounts, 1) : 1;

    const currentLevelId = this.toStr(profile.currentLevel);
    const currentFieldId = this.toStr(profile.currentField);
    const weakSubjectIds = new Set(
      (profile.stats?.weakSubjects ?? []).map((s) => this.toStr(s)),
    );
    const strongSubjectIds = new Set(
      (profile.stats?.strongSubjects ?? []).map((s) => this.toStr(s)),
    );
    const preferredFormats =
      profile.cognitiveProfile
        ? COGNITIVE_FORMAT_MAP[profile.cognitiveProfile] ?? []
        : [];
    const targetDifficulties =
      profile.learnerType
        ? LEARNER_DIFFICULTY_MAP[profile.learnerType] ?? []
        : [];

    const scored: ScoredMedia[] = candidates.map((media) => {
      const levelScore = this.matchArrayField(
        media.targetLevels,
        currentLevelId,
      );
      const fieldScore = this.matchArrayField(
        media.targetFields,
        currentFieldId,
      );

      let subjectScore = 0;
      const mediaSubjectIds = (media.subjects ?? []).map((s) =>
        this.toStr(s),
      );
      const weakMatches = mediaSubjectIds.filter((id) =>
        weakSubjectIds.has(id),
      ).length;
      const strongMatches = mediaSubjectIds.filter((id) =>
        strongSubjectIds.has(id),
      ).length;
      if (weakMatches > 0) {
        subjectScore = 1.0;
      } else if (strongMatches > 0) {
        subjectScore = 0.4;
      } else if (mediaSubjectIds.length > 0) {
        subjectScore = 0.1;
      }

      const cognitiveScore =
        preferredFormats.length > 0 &&
        preferredFormats.includes(media.mediaType)
          ? 1.0
          : preferredFormats.length > 0
            ? 0.3
            : 0.5;

      const difficultyScore =
        media.difficulty && targetDifficulties.length > 0
          ? targetDifficulties.includes(media.difficulty)
            ? 1.0
            : 0.2
          : 0.5;

      const popularityScore =
        maxPlay > 0
          ? ss.min([
              (media.playCount ?? 0) / maxPlay,
              1.0,
            ])
          : 0;

      const totalScore =
        WEIGHTS.level * levelScore +
        WEIGHTS.field * fieldScore +
        WEIGHTS.subject * subjectScore +
        WEIGHTS.cognitive * cognitiveScore +
        WEIGHTS.difficulty * difficultyScore +
        WEIGHTS.popularity * popularityScore;

      return { media, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Garantit la diversité de format dans les résultats :
   * au moins 2 types de médias différents si disponibles.
   */
  private ensureFormatDiversity(
    scored: ScoredMedia[],
    limit: number,
  ): IMedia[] {
    if (scored.length <= limit) {
      return scored.map((s) => s.media);
    }

    const result: IMedia[] = [];
    const typesSeen = new Set<MediaType>();
    const used = new Set<number>();

    for (let i = 0; i < scored.length && result.length < limit; i++) {
      const { media } = scored[i];
      if (!typesSeen.has(media.mediaType) || typesSeen.size >= 2) {
        result.push(media);
        typesSeen.add(media.mediaType);
        used.add(i);
      }
    }

    for (let i = 0; i < scored.length && result.length < limit; i++) {
      if (!used.has(i)) {
        result.push(scored[i].media);
      }
    }

    return result.slice(0, limit);
  }

  /**
   * Fallback : médias populaires (non personnalisés).
   */
  private async getPopularFallback(
    limit: number,
    excludeMediaId?: string,
  ): Promise<RecommendationResult> {
    const filter: Record<string, unknown> = {
      status: MediaStatus.APPROVED,
      scope: MediaScope.GLOBAL,
    };

    if (excludeMediaId && mongoose.isValidObjectId(excludeMediaId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeMediaId) };
    }

    const items = await Media.find(filter)
      .populate("submittedBy", "name image")
      .select(
        "_id mediaType title description duration price currency playCount purchaseCount coverImageKey submittedBy createdAt seriesTitle episodeNumber seasonNumber",
      )
      .sort({ playCount: -1, createdAt: -1 })
      .limit(limit)
      .lean<IMedia[]>();

    return {
      items,
      personalized: false,
      fallback: items.length === 0,
    };
  }

  /**
   * Construit la liste des médias à exclure :
   * - Le média courant (excludeMediaId)
   * - Les médias déjà achetés par l'utilisateur
   */
  private async getExcludedMediaIds(
    userId: string,
    excludeMediaId?: string,
  ): Promise<mongoose.Types.ObjectId[]> {
    const ids: mongoose.Types.ObjectId[] = [];

    if (excludeMediaId && mongoose.isValidObjectId(excludeMediaId)) {
      ids.push(new mongoose.Types.ObjectId(excludeMediaId));
    }

    const purchases = await MediaPurchase.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: MediaPurchaseStatus.COMPLETED,
    })
      .select("mediaId")
      .lean();

    for (const p of purchases) {
      ids.push(p.mediaId);
    }

    return ids;
  }

  /**
   * Filtre MongoDB de base pour les candidats à recommander.
   */
  private buildMatchFilter(
    excludeIds: mongoose.Types.ObjectId[],
    userSchoolIds?: string[],
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      status: MediaStatus.APPROVED,
    };

    if (excludeIds.length > 0) {
      filter._id = { $nin: excludeIds };
    }

    if (userSchoolIds?.length) {
      filter.$or = [
        { scope: MediaScope.GLOBAL },
        {
          scope: MediaScope.SCHOOL,
          schoolId: {
            $in: userSchoolIds.map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
      ];
    } else {
      filter.scope = MediaScope.GLOBAL;
    }

    return filter;
  }

  /** Convertit un ObjectId peuplé ou brut en string */
  private toStr(
    val: mongoose.Types.ObjectId | { _id?: mongoose.Types.ObjectId } | undefined | null,
  ): string {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object" && "_id" in val && val._id) {
      return val._id.toString();
    }
    return val.toString();
  }

  /** Vérifie si un ID est présent dans un tableau de refs */
  private matchArrayField(
    fieldArray: mongoose.Types.ObjectId[] | undefined,
    targetId: string,
  ): number {
    if (!fieldArray?.length || !targetId) return 0;
    return fieldArray.some((ref) => this.toStr(ref) === targetId) ? 1.0 : 0;
  }
}

export const mediaRecommendationService = new MediaRecommendationService();
