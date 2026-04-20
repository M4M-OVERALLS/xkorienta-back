import connectDB from '@/lib/mongodb'
import BookConfig, { IBookConfig } from '@/models/BookConfig'

/**
 * Singleton repository for BookConfig.
 * There is always exactly one BookConfig document in the collection.
 */
export class BookConfigRepository {
    /**
     * Returns the existing config or creates one with defaults.
     */
    async getOrCreate(): Promise<IBookConfig> {
        await connectDB()
        let config = await BookConfig.findOne().lean() as IBookConfig | null

        if (!config) {
            config = await BookConfig.create({})
        }

        return config
    }

    async update(data: Partial<IBookConfig>): Promise<IBookConfig> {
        await connectDB()
        const config = await BookConfig.findOneAndUpdate(
            {},
            { $set: data },
            { new: true, upsert: true }
        ).lean()

        return config as IBookConfig
    }
}

export const bookConfigRepository = new BookConfigRepository()
