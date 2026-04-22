import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { IStorageStrategy } from './IStorageStrategy'

const BOOKS_DIR = path.join(process.cwd(), 'private', 'books')

/**
 * Stores book files on the local filesystem in /private/books/.
 * Files are NOT served from /public to prevent unauthenticated access.
 * Download URLs are served through the authenticated /api/books/[id]/access route.
 */
export class LocalStorageStrategy implements IStorageStrategy {
    async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
        await fs.mkdir(BOOKS_DIR, { recursive: true })

        const ext = this.mimeToExt(mimeType)
        const safeBase = path.basename(filename, path.extname(filename))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 50)

        const fileKey = `${safeBase}-${randomUUID()}.${ext}`
        const absolutePath = path.join(BOOKS_DIR, fileKey)

        await fs.writeFile(absolutePath, buffer)
        return fileKey
    }

    async delete(fileKey: string): Promise<void> {
        const absolutePath = path.join(BOOKS_DIR, fileKey)
        try {
            await fs.unlink(absolutePath)
        } catch (err: unknown) {
            // File already gone — not an error
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
    }

    /**
     * Returns a relative API path. The route handler streams the file
     * after checking the user's access rights.
     */
    async getDownloadUrl(fileKey: string): Promise<string> {
        return fileKey
    }

    /**
     * Returns the absolute path for streaming by the route handler.
     */
    getAbsolutePath(fileKey: string): string {
        return path.join(BOOKS_DIR, fileKey)
    }

    private mimeToExt(mimeType: string): string {
        const map: Record<string, string> = {
            'application/pdf':       'pdf',
            'application/epub+zip':  'epub',
        }
        return map[mimeType] ?? 'bin'
    }
}

export const localStorageStrategy = new LocalStorageStrategy()
