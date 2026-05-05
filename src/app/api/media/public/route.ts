import { NextResponse } from 'next/server'
import { mediaRepository } from '@/lib/repositories/MediaRepository'
import { MediaService } from '@/lib/services/MediaService'
import { MediaStatus, MediaScope } from '@/models/enums'

/**
 * GET /api/media/public
 * Endpoint public — sans authentification.
 * Retourne les médias approuvés paginés pour la médiathèque publique.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)

        const result = await mediaRepository.findPaginated({
            status:    MediaStatus.APPROVED,
            scope:     MediaScope.GLOBAL,
            mediaType: (searchParams.get('mediaType') as any) ?? undefined,
            minPrice:  searchParams.get('free') === '1' ? 0 : undefined,
            maxPrice:  searchParams.get('free') === '1' ? 0 : undefined,
            search:    searchParams.get('search') ?? undefined,
            page:      Number(searchParams.get('page') ?? 1),
            limit:     Math.min(Number(searchParams.get('limit') ?? 24), 50),
            catalogPreview: true,
        })

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                items: result.items.map((m) => ({
                    ...(m as unknown as Record<string, unknown>),
                    coverImageUrl: MediaService.buildCoverUrl(
                        (m as unknown as Record<string, unknown>).coverImageKey as string | undefined
                    ),
                })),
            },
        })
    } catch (err) {
        return NextResponse.json(
            { success: false, message: (err as Error).message },
            { status: 500 }
        )
    }
}
