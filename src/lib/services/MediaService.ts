import { fileTypeFromBuffer } from 'file-type'
import { IMedia } from '@/models/Media'
import { MediaType, MediaScope, MediaStatus, UserRole } from '@/models/enums'
import { mediaRepository, MediaFilters, PaginatedMedia } from '@/lib/repositories/MediaRepository'
import { bookConfigRepository } from '@/lib/repositories/BookConfigRepository'
import { StorageStrategyFactory } from '@/lib/strategies/storage/StorageStrategyFactory'
import { localMediaStorageStrategy } from '@/lib/strategies/storage/LocalStorageStrategy'
import { BookService } from './BookService'
import mongoose from 'mongoose'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Limites par type (en octets)
const MAX_FILE_SIZE_BY_TYPE: Record<MediaType, number> = {
    [MediaType.VIDEO]:   500 * 1024 * 1024, // 500 Mo
    [MediaType.PODCAST]: 200 * 1024 * 1024, // 200 Mo
    [MediaType.AUDIO]:   100 * 1024 * 1024, // 100 Mo
}

/** MIME types autorisés par type de média */
const ALLOWED_MIMES_BY_TYPE: Record<MediaType, string[]> = {
    [MediaType.VIDEO]:   ['video/mp4', 'video/webm', 'video/ogg'],
    [MediaType.PODCAST]: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/webm'],
    [MediaType.AUDIO]:   ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/webm'],
}

export interface SubmitMediaInput {
    mediaType: MediaType
    title: string
    description: string
    fileBuffer: Buffer
    fileOriginalName: string
    coverBuffer?: Buffer
    coverOriginalName?: string
    price: number
    currency?: string
    scope: MediaScope
    schoolId?: string
    copyrightAccepted: boolean
    teacherId: string
    // Métadonnées optionnelles
    duration?: number
    seriesTitle?: string
    episodeNumber?: number
    seasonNumber?: number
}

export interface UpdateMediaInput {
    title?: string
    description?: string
    price?: number
    currency?: string
    seriesTitle?: string
    episodeNumber?: number
    seasonNumber?: number
}

export interface ValidateMediaInput {
    mediaId: string
    adminId: string
    adminRole: UserRole
    adminSchoolIds: string[]
}

export class MediaService {
    private static isPlatformAdmin(role: UserRole): boolean {
        return role === UserRole.DG_M4M || role === UserRole.TECH_SUPPORT
    }

    private static extractObjectId(value: unknown): string | undefined {
        if (!value) return undefined
        if (typeof value === 'string') return value
        if (typeof value === 'object' && value !== null) {
            const maybeId = (value as { _id?: unknown })._id
            if (typeof maybeId === 'string') return maybeId
            if (maybeId && typeof maybeId === 'object' && 'toString' in (maybeId as object))
                return (maybeId as { toString: () => string }).toString()
            if ('toString' in value) return (value as { toString: () => string }).toString()
        }
        return undefined
    }

    /**
     * Valide et stocke un fichier média, puis crée l'entrée en base.
     * Le média est immédiatement mis en PENDING pour revue admin.
     */
    static async submitMedia(input: SubmitMediaInput): Promise<IMedia> {
        if (!input.copyrightAccepted) {
            throw new Error('Vous devez accepter la déclaration de droits d\'auteur')
        }

        // Vérification de la taille
        const maxBytes = MAX_FILE_SIZE_BY_TYPE[input.mediaType]
        if (input.fileBuffer.byteLength > maxBytes) {
            const maxMB = Math.round(maxBytes / (1024 * 1024))
            throw new Error(`Fichier trop volumineux. Taille maximale : ${maxMB} Mo`)
        }

        // Vérification du type MIME
        const detected = await fileTypeFromBuffer(input.fileBuffer)
        const allowedMimes = ALLOWED_MIMES_BY_TYPE[input.mediaType]

        if (!detected || !allowedMimes.includes(detected.mime)) {
            throw new Error(
                `Type de fichier invalide pour ${input.mediaType}. Types acceptés : ${allowedMimes.join(', ')}`
            )
        }

        if (input.scope === MediaScope.SCHOOL && !input.schoolId) {
            throw new Error('schoolId est requis pour une portée SCHOOL')
        }

        if (input.price < 0) {
            throw new Error('Le prix ne peut pas être négatif')
        }

        // Stockage du fichier dans private/media/
        const fileKey = await localMediaStorageStrategy.upload(
            input.fileBuffer,
            input.fileOriginalName,
            detected.mime
        )

        // Couverture optionnelle
        let coverImageKey: string | undefined
        if (input.coverBuffer && input.coverOriginalName) {
            coverImageKey = await MediaService.saveCoverImage(input.coverBuffer, input.coverOriginalName)
        }

        return mediaRepository.create({
            mediaType: input.mediaType,
            title: input.title.trim(),
            description: input.description.trim(),
            fileKey,
            mimeType: detected.mime,
            fileSize: input.fileBuffer.byteLength,
            duration: input.duration,
            coverImageKey,
            price: input.price,
            currency: (input.currency ?? 'XAF').toUpperCase(),
            scope: input.scope,
            schoolId: input.schoolId ? new mongoose.Types.ObjectId(input.schoolId) : undefined,
            submittedBy: new mongoose.Types.ObjectId(input.teacherId),
            status: MediaStatus.PENDING,
            copyrightAccepted: true,
            seriesTitle: input.seriesTitle,
            episodeNumber: input.episodeNumber,
            seasonNumber: input.seasonNumber,
        })
    }

    /** Sauvegarde l'image de couverture dans public/uploads/covers/ */
    private static async saveCoverImage(buffer: Buffer, originalName: string): Promise<string> {
        const COVERS_DIR = path.join(process.cwd(), 'public', 'uploads', 'covers')
        await mkdir(COVERS_DIR, { recursive: true })
        const ext = path.extname(originalName).toLowerCase() || '.jpg'
        const key = `${randomUUID()}${ext}`
        await writeFile(path.join(COVERS_DIR, key), buffer)
        return key
    }

    /** Construit l'URL publique d'une image de couverture (même logique que BookService). */
    static buildCoverUrl(coverImageKey: string | undefined): string | undefined {
        return BookService.buildCoverUrl(coverImageKey)
    }

    /** Catalogue public — uniquement les médias APPROVED. */
    static async getCatalogue(filters: Omit<MediaFilters, 'status'>): Promise<PaginatedMedia> {
        return mediaRepository.findPaginated({ ...filters, status: MediaStatus.APPROVED })
    }

    /** Détail d'un média pour accès public (APPROVED uniquement). */
    static async getPublicMediaById(id: string): Promise<IMedia> {
        const media = await mediaRepository.findById(id)
        if (!media || media.status !== MediaStatus.APPROVED) {
            throw new Error('Média introuvable')
        }
        return media
    }

    /** Détail d'un média — propriétaire ou admin peut voir les médias non approuvés. */
    static async getMediaById(id: string, requesterId: string, requesterRole: UserRole): Promise<IMedia> {
        const media = await mediaRepository.findById(id)
        if (!media) throw new Error('Média introuvable')

        const submittedById = MediaService.extractObjectId(media.submittedBy)
        const isOwner = submittedById === requesterId
        const isAdmin =
            requesterRole === UserRole.SCHOOL_ADMIN ||
            MediaService.isPlatformAdmin(requesterRole)

        if (media.status !== MediaStatus.APPROVED && !isOwner && !isAdmin) {
            throw new Error('Média introuvable')
        }

        return media
    }

    /** Met à jour les métadonnées d'un média (propriétaire uniquement, en DRAFT). */
    static async updateMedia(
        mediaId: string,
        requesterId: string,
        data: UpdateMediaInput
    ): Promise<IMedia> {
        const media = await mediaRepository.findById(mediaId)
        if (!media) throw new Error('Média introuvable')
        const submittedById = MediaService.extractObjectId(media.submittedBy)
        if (submittedById !== requesterId) throw new Error('Interdit : vous ne pouvez modifier que vos propres médias')
        if (media.status !== MediaStatus.DRAFT) throw new Error('Seuls les médias en DRAFT peuvent être modifiés')
        if (data.price !== undefined && data.price < 0) throw new Error('Le prix ne peut pas être négatif')

        return mediaRepository.updateById(mediaId, {
            ...data,
            currency: data.currency?.toUpperCase(),
        }) as Promise<IMedia>
    }

    /** Supprime un média (propriétaire uniquement, en DRAFT). */
    static async deleteMedia(mediaId: string, requesterId: string): Promise<void> {
        const media = await mediaRepository.findById(mediaId)
        if (!media) throw new Error('Média introuvable')
        const submittedById = MediaService.extractObjectId(media.submittedBy)
        if (submittedById !== requesterId) throw new Error('Interdit : vous ne pouvez supprimer que vos propres médias')
        if (media.status !== MediaStatus.DRAFT) throw new Error('Seuls les médias en DRAFT peuvent être supprimés')

        await localMediaStorageStrategy.delete(media.fileKey)
        await mediaRepository.deleteById(mediaId)
    }

    /** Approuve un média en attente. */
    static async approveMedia(input: ValidateMediaInput): Promise<IMedia> {
        const media = await mediaRepository.findById(input.mediaId)
        if (!media) throw new Error('Média introuvable')
        if (media.status !== MediaStatus.PENDING) throw new Error('Seuls les médias PENDING peuvent être approuvés')

        MediaService.checkValidationPermission(media, input)

        return mediaRepository.updateById(input.mediaId, {
            status: MediaStatus.APPROVED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
        }) as Promise<IMedia>
    }

    /** Rejette un média avec un commentaire obligatoire. */
    static async rejectMedia(input: ValidateMediaInput & { comment: string }): Promise<IMedia> {
        if (!input.comment?.trim()) throw new Error('Un commentaire de rejet est obligatoire')

        const media = await mediaRepository.findById(input.mediaId)
        if (!media) throw new Error('Média introuvable')
        if (media.status !== MediaStatus.PENDING) throw new Error('Seuls les médias PENDING peuvent être rejetés')

        MediaService.checkValidationPermission(media, input)

        return mediaRepository.updateById(input.mediaId, {
            status: MediaStatus.REJECTED,
            validatedBy: new mongoose.Types.ObjectId(input.adminId),
            validatedAt: new Date(),
            validationComment: input.comment.trim(),
        }) as Promise<IMedia>
    }

    /** Retourne les médias en attente de validation. */
    static async getPendingMedia(adminRole: UserRole, adminSchoolIds: string[]): Promise<IMedia[]> {
        if (MediaService.isPlatformAdmin(adminRole)) {
            return mediaRepository.findPending()
        }
        if (adminRole === UserRole.SCHOOL_ADMIN && adminSchoolIds.length > 0) {
            const results = await Promise.all(
                adminSchoolIds.map((sid) => mediaRepository.findPending(MediaScope.SCHOOL, sid))
            )
            return results.flat()
        }
        return []
    }

    /** Retourne la liste des médias d'un enseignant. */
    static async getTeacherMedia(teacherId: string, page = 1, limit = 20): Promise<PaginatedMedia> {
        return mediaRepository.findByTeacher(teacherId, page, limit)
    }

    /**
     * Vérifie l'accès et retourne la clé du fichier pour streaming.
     * Incrémente le compteur de lectures.
     */
    static async getStreamKey(mediaId: string): Promise<{ fileKey: string; mimeType: string; fileSize: number }> {
        const media = await mediaRepository.findById(mediaId)
        if (!media) throw new Error('Média introuvable')

        await mediaRepository.incrementPlayCount(mediaId)

        return {
            fileKey: media.fileKey,
            mimeType: media.mimeType,
            fileSize: media.fileSize,
        }
    }

    private static checkValidationPermission(media: IMedia, input: ValidateMediaInput): void {
        if (MediaService.isPlatformAdmin(input.adminRole)) return

        if (media.scope === MediaScope.GLOBAL) {
            throw new Error('Seuls les administrateurs plateforme peuvent valider les médias globaux')
        }

        if (input.adminRole !== UserRole.SCHOOL_ADMIN) {
            throw new Error('Seuls les administrateurs d\'école peuvent valider les médias d\'école')
        }
        if (!input.adminSchoolIds.includes(media.schoolId?.toString() ?? '')) {
            throw new Error('Vous ne pouvez valider que les médias de votre école')
        }
    }
}
