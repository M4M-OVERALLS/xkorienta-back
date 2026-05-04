import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { IStorageStrategy } from './IStorageStrategy'

const BOOKS_DIR = path.join(process.cwd(), 'private', 'books')
const MEDIA_DIR = path.join(process.cwd(), 'private', 'media')

const MIME_TO_EXT: Record<string, string> = {
    'application/pdf':       'pdf',
    'application/epub+zip':  'epub',
    'video/mp4':             'mp4',
    'video/webm':            'webm',
    'video/ogg':             'ogv',
    'audio/mpeg':            'mp3',
    'audio/mp4':             'm4a',
    'audio/ogg':             'ogg',
    'audio/wav':             'wav',
    'audio/aac':             'aac',
    'audio/webm':            'weba',
}

/**
 * Stores book files on the local filesystem in /private/books/.
 * Stores media files (video/audio) in /private/media/.
 * Files are NOT served from /public to prevent unauthenticated access.
 * Download URLs are served through the authenticated API routes.
 */
export class LocalStorageStrategy implements IStorageStrategy {
    private readonly dir: string

    constructor(dir?: string) {
        this.dir = dir ?? BOOKS_DIR
    }

    async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
        await fs.mkdir(this.dir, { recursive: true })

        const ext = MIME_TO_EXT[mimeType] ?? 'bin'
        const safeBase = path.basename(filename, path.extname(filename))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 50)

        const fileKey = `${safeBase}-${randomUUID()}.${ext}`
        const absolutePath = path.join(this.dir, fileKey)

        await fs.writeFile(absolutePath, buffer)
        return fileKey
    }

    async delete(fileKey: string): Promise<void> {
        const absolutePath = path.join(this.dir, fileKey)
        try {
            await fs.unlink(absolutePath)
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
    }

    /**
     * Returns a relative file key. The route handler streams the file
     * after checking the user's access rights.
     */
    async getDownloadUrl(fileKey: string): Promise<string> {
        return fileKey
    }

    /**
     * Returns the absolute path for streaming by the route handler.
     */
    getAbsolutePath(fileKey: string): string {
        return path.join(this.dir, fileKey)
    }

    /**
     * Returns a ReadStream with optional byte range (for HTTP 206 streaming).
     */
    createReadStream(
        fileKey: string,
        options?: { start?: number; end?: number }
    ): fsSync.ReadStream {
        const absolutePath = path.join(this.dir, fileKey)
        return fsSync.createReadStream(absolutePath, options)
    }

    /**
     * Returns the file size in bytes.
     */
    async getFileSize(fileKey: string): Promise<number> {
        const absolutePath = path.join(this.dir, fileKey)
        const stat = await fs.stat(absolutePath)
        return stat.size
    }
}

/** Default instance for books (private/books/) */
export const localStorageStrategy = new LocalStorageStrategy(BOOKS_DIR)

/** Instance for media files (private/media/) */
export const localMediaStorageStrategy = new LocalStorageStrategy(MEDIA_DIR)
