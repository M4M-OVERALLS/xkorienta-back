/**
 * Interface contrat pour les stratégies de stockage de fichiers.
 * Permet de changer le provider (local, S3, R2) sans modifier les services.
 */
export interface IStorageStrategy {
    /**
     * Uploads a file buffer and returns an opaque file key for future retrieval.
     * @param buffer    Raw file content
     * @param filename  Desired filename (may be sanitized internally)
     * @param mimeType  MIME type of the file
     * @returns         Opaque storage key (e.g. path or S3 key)
     */
    upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>

    /**
     * Permanently deletes a file identified by its key.
     * @param fileKey  Key returned by upload()
     */
    delete(fileKey: string): Promise<void>

    /**
     * Returns a URL (or signed URL) for downloading the file.
     * URL validity may be time-limited depending on the provider.
     * @param fileKey   Key returned by upload()
     * @param expiresIn Expiry in seconds (providers that support signed URLs)
     * @returns         Download URL
     */
    getDownloadUrl(fileKey: string, expiresIn?: number): Promise<string>
}
