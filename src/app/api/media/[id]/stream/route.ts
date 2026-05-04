import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MediaService } from '@/lib/services/MediaService'
import { MediaPurchaseService } from '@/lib/services/MediaPurchaseService'
import { localMediaStorageStrategy } from '@/lib/strategies/storage/LocalStorageStrategy'
import { Readable } from 'stream'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/media/[id]/stream
 *
 * Diffuse le fichier média en streaming avec support HTTP Range (RFC 7233).
 * Renvoie 206 Partial Content pour les requêtes avec Range header (nécessaire
 * pour les lecteurs HTML5 <video> et <audio>).
 *
 * Accès :
 *  - Médias gratuits (price = 0) : accessible à tous les utilisateurs connectés
 *  - Médias payants : achat requis
 */
export async function GET(req: Request, { params }: Params) {
    try {
        const { id } = await params

        // Authentification obligatoire
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }

        // Vérification de l'accès (gratuit ou acheté)
        const hasAccess = await MediaPurchaseService.hasAccess(session.user.id, id)
        if (!hasAccess) {
            return NextResponse.json(
                { success: false, message: 'Accès refusé. Achetez ce média pour le lire.' },
                { status: 403 }
            )
        }

        // Récupère les infos du fichier
        const { fileKey, mimeType, fileSize } = await MediaService.getStreamKey(id)

        const rangeHeader = req.headers.get('range')

        if (!rangeHeader) {
            // Réponse complète (200)
            const stream = localMediaStorageStrategy.createReadStream(fileKey)
            const nodeReadable = Readable.from(stream)
            const webStream = nodeReadableToWebStream(nodeReadable)

            return new Response(webStream, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': String(fileSize),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-cache',
                },
            })
        }

        // Parsing du Range header
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        if (start >= fileSize || end >= fileSize || start > end) {
            return new Response(null, {
                status: 416,
                headers: {
                    'Content-Range': `bytes */${fileSize}`,
                },
            })
        }

        const chunkSize = end - start + 1
        const stream    = localMediaStorageStrategy.createReadStream(fileKey, { start, end })
        const nodeReadable = Readable.from(stream)
        const webStream    = nodeReadableToWebStream(nodeReadable)

        return new Response(webStream, {
            status: 206,
            headers: {
                'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges':  'bytes',
                'Content-Length': String(chunkSize),
                'Content-Type':   mimeType,
                'Cache-Control':  'no-cache',
            },
        })
    } catch (err) {
        const message = (err as Error).message
        return NextResponse.json(
            { success: false, message },
            { status: message.includes('introuvable') ? 404 : 500 }
        )
    }
}

/** Convertit un Readable Node.js en ReadableStream Web API. */
function nodeReadableToWebStream(nodeReadable: Readable): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            nodeReadable.on('data', (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk))
            })
            nodeReadable.on('end', () => controller.close())
            nodeReadable.on('error', (err) => controller.error(err))
        },
        cancel() {
            nodeReadable.destroy()
        },
    })
}
