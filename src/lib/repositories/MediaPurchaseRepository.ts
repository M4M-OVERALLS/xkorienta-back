import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import MediaPurchase, { IMediaPurchase } from '@/models/MediaPurchase'
import { MediaPurchaseStatus } from '@/models/enums'

export class MediaPurchaseRepository {
    async findByUserAndMedia(userId: string, mediaId: string): Promise<IMediaPurchase | null> {
        await connectDB()
        return MediaPurchase.findOne({
            userId:  new mongoose.Types.ObjectId(userId),
            mediaId: new mongoose.Types.ObjectId(mediaId),
        }).lean() as Promise<IMediaPurchase | null>
    }

    async findByReference(reference: string): Promise<IMediaPurchase | null> {
        await connectDB()
        return MediaPurchase.findOne({ paymentReference: reference }).lean() as Promise<IMediaPurchase | null>
    }

    async findByUser(userId: string, page = 1, limit = 20): Promise<IMediaPurchase[]> {
        await connectDB()
        const skip = (page - 1) * limit

        return MediaPurchase.find({
            userId: new mongoose.Types.ObjectId(userId),
            status: MediaPurchaseStatus.COMPLETED,
        })
            .populate('mediaId', 'title mediaType mimeType duration coverImageKey price currency submittedBy')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean() as Promise<IMediaPurchase[]>
    }

    async hasAccess(userId: string, mediaId: string): Promise<boolean> {
        await connectDB()
        const purchase = await MediaPurchase.findOne({
            userId:  new mongoose.Types.ObjectId(userId),
            mediaId: new mongoose.Types.ObjectId(mediaId),
            status:  MediaPurchaseStatus.COMPLETED,
        })
            .select('_id')
            .lean()
        return purchase !== null
    }

    async create(data: Partial<IMediaPurchase>): Promise<IMediaPurchase> {
        await connectDB()
        return MediaPurchase.create(data)
    }

    async updateStatus(id: string, status: MediaPurchaseStatus): Promise<IMediaPurchase | null> {
        await connectDB()
        return MediaPurchase.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        ).lean() as Promise<IMediaPurchase | null>
    }

    async updateStatusByReference(
        reference: string,
        status: MediaPurchaseStatus
    ): Promise<IMediaPurchase | null> {
        await connectDB()
        return MediaPurchase.findOneAndUpdate(
            { paymentReference: reference },
            { $set: { status } },
            { new: true }
        ).lean() as Promise<IMediaPurchase | null>
    }
}

export const mediaPurchaseRepository = new MediaPurchaseRepository()
