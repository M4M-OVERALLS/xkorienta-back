import { NextResponse } from 'next/server'
import { MediaService } from '@/lib/services/MediaService'
import { MediaPurchaseService } from '@/lib/services/MediaPurchaseService'
import { MediaScope, MediaType, UserRole } from '@/models/enums'

export class MediaController {
    /** Enrichit un média avec son URL de couverture. */
    static enrichWithCoverUrl(media: Record<string, unknown>): Record<string, unknown> {
        return {
            ...media,
            coverImageUrl: MediaService.buildCoverUrl(media.coverImageKey as string | undefined),
        }
    }

    /** GET /api/media — liste authentifiée */
    static async getCatalogue(
        req: Request,
        session: { user: { id: string; role: string; schools?: string[] } }
    ) {
        const { searchParams } = new URL(req.url)

        const result = await MediaService.getCatalogue({
            mediaType: (searchParams.get('mediaType') as MediaType) ?? undefined,
            scope:     (searchParams.get('scope') as MediaScope) ?? undefined,
            schoolId:  searchParams.get('schoolId') ?? undefined,
            minPrice:  searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
            maxPrice:  searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
            search:    searchParams.get('search') ?? undefined,
            page:      Number(searchParams.get('page') ?? 1),
            limit:     Number(searchParams.get('limit') ?? 20),
        })

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                items: result.items.map((m) =>
                    MediaController.enrichWithCoverUrl(m as unknown as Record<string, unknown>)
                ),
            },
        })
    }

    /** GET /api/media/[id] — authentifié */
    static async getMedia(id: string, session: { user: { id: string; role: string } }) {
        const media = await MediaService.getMediaById(id, session.user.id, session.user.role as UserRole)
        return NextResponse.json({
            success: true,
            data: MediaController.enrichWithCoverUrl(media as unknown as Record<string, unknown>),
        })
    }

    /** GET /api/media/[id] — sans auth, APPROVED uniquement */
    static async getPublicMedia(id: string) {
        const media = await MediaService.getPublicMediaById(id)
        return NextResponse.json({
            success: true,
            data: MediaController.enrichWithCoverUrl(media as unknown as Record<string, unknown>),
        })
    }

    /** POST /api/media — soumission d'un nouveau média */
    static async submitMedia(req: Request, session: { user: { id: string; schools?: string[] } }) {
        const formData = await req.formData()

        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ success: false, message: 'Le fichier est requis' }, { status: 400 })
        }

        const mediaTypeRaw = formData.get('mediaType') as string
        if (!Object.values(MediaType).includes(mediaTypeRaw as MediaType)) {
            return NextResponse.json(
                { success: false, message: `mediaType invalide. Valeurs acceptées : ${Object.values(MediaType).join(', ')}` },
                { status: 400 }
            )
        }
        const mediaType = mediaTypeRaw as MediaType

        const title        = (formData.get('title') as string)?.trim()
        const description  = (formData.get('description') as string)?.trim()
        const price        = Number(formData.get('price') ?? 0)
        const currency     = (formData.get('currency') as string) ?? 'XAF'
        const scope        = (formData.get('scope') as MediaScope) ?? MediaScope.GLOBAL
        const schoolId     = (formData.get('schoolId') as string) ?? undefined
        const copyrightAccepted = formData.get('copyrightAccepted') === 'true'
        const duration     = formData.get('duration') ? Number(formData.get('duration')) : undefined
        const seriesTitle  = (formData.get('seriesTitle') as string) ?? undefined
        const episodeNumber = formData.get('episodeNumber') ? Number(formData.get('episodeNumber')) : undefined
        const seasonNumber  = formData.get('seasonNumber')  ? Number(formData.get('seasonNumber'))  : undefined

        if (!title) return NextResponse.json({ success: false, message: 'title est requis' }, { status: 400 })
        if (!description) return NextResponse.json({ success: false, message: 'description est requise' }, { status: 400 })

        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // Couverture optionnelle
        const coverFile = formData.get('cover') as File | null
        let coverBuffer: Buffer | undefined
        let coverOriginalName: string | undefined
        if (coverFile && coverFile.size > 0) {
            const coverMime = coverFile.type
            if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(coverMime)) {
                return NextResponse.json(
                    { success: false, message: 'La couverture doit être JPEG, PNG ou WebP' },
                    { status: 400 }
                )
            }
            if (coverFile.size > 5 * 1024 * 1024) {
                return NextResponse.json(
                    { success: false, message: 'Image de couverture trop volumineuse. Maximum 5 Mo.' },
                    { status: 400 }
                )
            }
            coverBuffer = Buffer.from(await coverFile.arrayBuffer())
            coverOriginalName = coverFile.name
        }

        const media = await MediaService.submitMedia({
            mediaType,
            title,
            description,
            fileBuffer,
            fileOriginalName: file.name,
            coverBuffer,
            coverOriginalName,
            price,
            currency,
            scope,
            schoolId,
            copyrightAccepted,
            teacherId: session.user.id,
            duration,
            seriesTitle,
            episodeNumber,
            seasonNumber,
        })

        return NextResponse.json({ success: true, data: media }, { status: 201 })
    }

    /** PUT /api/media/[id] */
    static async updateMedia(req: Request, id: string, session: { user: { id: string } }) {
        const body = await req.json() as {
            title?: string; description?: string; price?: number; currency?: string
            seriesTitle?: string; episodeNumber?: number; seasonNumber?: number
        }
        const media = await MediaService.updateMedia(id, session.user.id, body)
        return NextResponse.json({ success: true, data: media })
    }

    /** DELETE /api/media/[id] */
    static async deleteMedia(id: string, session: { user: { id: string } }) {
        await MediaService.deleteMedia(id, session.user.id)
        return NextResponse.json({ success: true, message: 'Média supprimé' })
    }

    /** GET /api/media/my */
    static async getMyMedia(req: Request, session: { user: { id: string } }) {
        const { searchParams } = new URL(req.url)
        const media = await MediaService.getTeacherMedia(
            session.user.id,
            Number(searchParams.get('page') ?? 1),
            Number(searchParams.get('limit') ?? 20)
        )
        return NextResponse.json({ success: true, data: media })
    }

    /** GET /api/media/[id]/access — vérifie l'accès avant streaming */
    static async getAccess(req: Request, id: string, session: { user: { id: string } }) {
        const hasAccess = await MediaPurchaseService.hasAccess(session.user.id, id)
        if (!hasAccess) {
            return NextResponse.json(
                { success: false, message: 'Accès refusé. Achetez ce média d\'abord.' },
                { status: 403 }
            )
        }
        const streamInfo = await MediaService.getStreamKey(id)
        return NextResponse.json({ success: true, data: streamInfo })
    }

    /** POST /api/media/[id]/purchase */
    static async initiatePurchase(
        req: Request,
        id: string,
        session: { user: { id: string; email: string; gamification?: { level?: number } } }
    ) {
        let body: { callbackUrl?: string; paymentCurrency?: string } = {}
        const raw = await req.text()
        if (raw.trim()) {
            try { body = JSON.parse(raw) } catch {
                return NextResponse.json({ success: false, message: 'JSON invalide' }, { status: 400 })
            }
        }

        const appBase = (
            process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
        ).replace(/\/$/, '')
        const callbackUrl = body.callbackUrl ?? `${appBase}/mediatheque/${id}?payment=return`

        const result = await MediaPurchaseService.initiatePurchase({
            mediaId: id,
            userId: session.user.id,
            userEmail: session.user.email,
            userLevel: session.user.gamification?.level ?? 1,
            callbackUrl,
            paymentCurrency: body.paymentCurrency,
        })

        return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    /** GET /api/media/purchased */
    static async getPurchased(req: Request, session: { user: { id: string } }) {
        const { searchParams } = new URL(req.url)
        const purchases = await MediaPurchaseService.getPurchasedMedia(
            session.user.id,
            Number(searchParams.get('page') ?? 1),
            Number(searchParams.get('limit') ?? 20)
        )
        return NextResponse.json({ success: true, data: purchases })
    }
}
