import { readFile, stat } from 'fs/promises'
import path from 'path'

const UPLOAD_MIME: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
}

/**
 * Resout un chemin sous public/uploads/ de maniere securisee.
 * Retourne null si le chemin sort du repertoire autorise.
 */
export function resolvePublicUploadPath(segments: string[]): string | null {
    const safeSegments = segments.filter((segment) => segment && segment !== '.' && segment !== '..')
    if (safeSegments.length === 0) return null

    const uploadsRoot = path.join(process.cwd(), 'public', 'uploads')
    const absolutePath = path.resolve(uploadsRoot, ...safeSegments)

    if (!absolutePath.startsWith(uploadsRoot + path.sep) && absolutePath !== uploadsRoot) {
        return null
    }

    return absolutePath
}

/** Lit un fichier uploade depuis public/uploads/ avec son content-type. */
export async function readPublicUpload(segments: string[]): Promise<{
    buffer: Buffer
    contentType: string
    fileName: string
} | null> {
    const absolutePath = resolvePublicUploadPath(segments)
    if (!absolutePath) return null

    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) return null

    const buffer = await readFile(absolutePath)
    const ext = path.extname(absolutePath).slice(1).toLowerCase()
    const contentType = UPLOAD_MIME[ext] ?? 'application/octet-stream'

    return {
        buffer,
        contentType,
        fileName: path.basename(absolutePath),
    }
}
