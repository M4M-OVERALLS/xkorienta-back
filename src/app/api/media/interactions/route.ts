import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mediaInteractionRepository } from "@/lib/repositories/MediaInteractionRepository";
import { MediaInteractionType } from "@/models/enums";
import mongoose from "mongoose";

const VALID_EVENTS = new Set(Object.values(MediaInteractionType));

/**
 * POST /api/media/interactions
 *
 * Enregistre une interaction utilisateur-média.
 * Body JSON : { mediaId, eventType, completionRate?, sessionDuration? }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Non autorisé" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { mediaId, eventType, completionRate, sessionDuration } = body;

    if (!mediaId || !mongoose.isValidObjectId(mediaId)) {
      return NextResponse.json(
        { success: false, message: "mediaId invalide" },
        { status: 400 },
      );
    }

    if (!eventType || !VALID_EVENTS.has(eventType)) {
      return NextResponse.json(
        {
          success: false,
          message: `eventType invalide. Valeurs acceptées : ${[...VALID_EVENTS].join(", ")}`,
        },
        { status: 400 },
      );
    }

    const interaction = await mediaInteractionRepository.track(
      session.user.id,
      mediaId,
      eventType as MediaInteractionType,
      {
        completionRate:
          typeof completionRate === "number"
            ? Math.min(100, Math.max(0, completionRate))
            : undefined,
        sessionDuration:
          typeof sessionDuration === "number"
            ? Math.max(0, sessionDuration)
            : undefined,
      },
    );

    return NextResponse.json({
      success: true,
      data: { id: interaction._id },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: (err as Error).message },
      { status: 500 },
    );
  }
}
