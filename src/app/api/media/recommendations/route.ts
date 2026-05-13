import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mediaRecommendationService } from "@/lib/services/MediaRecommendationService";
import { MediaService } from "@/lib/services/MediaService";

/**
 * GET /api/media/recommendations
 *
 * Retourne des médias recommandés.
 * - Authentifié : recommandations personnalisées (profil apprenant)
 * - Non authentifié : fallback populaire (médias les plus écoutés)
 *
 * Query params :
 *   excludeId  — ID du média courant à exclure (optionnel)
 *   limit      — nombre de résultats (défaut 4, max 20)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeMediaId = searchParams.get("excludeId") ?? undefined;
    const limit = Math.min(
      Math.max(1, Number(searchParams.get("limit") ?? 4)),
      20,
    );

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;
    const userSchoolIds = (session?.user as { schools?: string[] })?.schools;

    const result = await mediaRecommendationService.getRecommendations({
      userId,
      excludeMediaId,
      limit,
      userSchoolIds,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items.map((m) => ({
          ...(m as unknown as Record<string, unknown>),
          coverImageUrl: MediaService.buildCoverUrl(
            (m as unknown as Record<string, unknown>).coverImageKey as
              | string
              | undefined,
          ),
        })),
        personalized: result.personalized,
        fallback: result.fallback,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: (err as Error).message },
      { status: 500 },
    );
  }
}
