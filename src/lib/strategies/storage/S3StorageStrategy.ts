import { randomUUID } from 'crypto'
import { IStorageStrategy } from './IStorageStrategy'

/**
 * S3-compatible storage strategy (AWS S3, MinIO, etc.).
 * Requires env vars: AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * NOTE: This is a scaffold. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
 * before activating this provider in BookConfig.
 */
export class S3StorageStrategy implements IStorageStrategy {
    private readonly bucket: string
    private readonly region: string

    constructor() {
        this.bucket = process.env.AWS_BUCKET ?? ''
        this.region = process.env.AWS_REGION ?? 'us-east-1'
    }

    async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
        // TODO: implement with @aws-sdk/client-s3
        // const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        // const client = new S3Client({ region: this.region })
        const ext = mimeType === 'application/epub+zip' ? 'epub' : 'pdf'
        const fileKey = `books/${randomUUID()}.${ext}`
        throw new Error(`S3StorageStrategy.upload not yet implemented. Key would be: ${fileKey}`)
    }

    async delete(fileKey: string): Promise<void> {
        // TODO: implement with @aws-sdk/client-s3
        throw new Error(`S3StorageStrategy.delete not yet implemented for key: ${fileKey}`)
    }

    async getDownloadUrl(fileKey: string, expiresIn = 900): Promise<string> {
        // TODO: implement with @aws-sdk/s3-request-presigner
        throw new Error(
            `S3StorageStrategy.getDownloadUrl not yet implemented for key: ${fileKey}, expires: ${expiresIn}s`
        )
    }
}

export const s3StorageStrategy = new S3StorageStrategy()
