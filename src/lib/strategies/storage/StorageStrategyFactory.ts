import { StorageProvider } from '@/models/enums'
import { IStorageStrategy } from './IStorageStrategy'
import { localStorageStrategy } from './LocalStorageStrategy'
import { s3StorageStrategy } from './S3StorageStrategy'

/**
 * Factory that resolves the correct IStorageStrategy from the provider name
 * stored in BookConfig. Swap providers without touching service logic.
 */
export class StorageStrategyFactory {
    static create(provider: string): IStorageStrategy {
        switch (provider as StorageProvider) {
            case StorageProvider.LOCAL:
                return localStorageStrategy
            case StorageProvider.S3:
            case StorageProvider.CLOUDFLARE_R2:
                return s3StorageStrategy
            default:
                return localStorageStrategy
        }
    }
}
