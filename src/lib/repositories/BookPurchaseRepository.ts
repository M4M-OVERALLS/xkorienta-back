import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import BookPurchase, { IBookPurchase } from '@/models/BookPurchase'
import { BookPurchaseStatus } from '@/models/enums'

export class BookPurchaseRepository {
    async findByUserAndBook(userId: string, bookId: string): Promise<IBookPurchase | null> {
        await connectDB()
        return BookPurchase.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            bookId: new mongoose.Types.ObjectId(bookId),
        }).lean() as Promise<IBookPurchase | null>
    }

    async findByReference(reference: string): Promise<IBookPurchase | null> {
        await connectDB()
        return BookPurchase.findOne({ paymentReference: reference }).lean() as Promise<IBookPurchase | null>
    }

    async findByUser(userId: string, page = 1, limit = 20): Promise<IBookPurchase[]> {
        await connectDB()
        const skip = (page - 1) * limit

        return BookPurchase.find({
            userId: new mongoose.Types.ObjectId(userId),
            status: BookPurchaseStatus.COMPLETED,
        })
            .populate('bookId', 'title description format coverImageKey price currency submittedBy')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean() as Promise<IBookPurchase[]>
    }

    async hasAccess(userId: string, bookId: string): Promise<boolean> {
        await connectDB()
        const purchase = await BookPurchase.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            bookId: new mongoose.Types.ObjectId(bookId),
            status: BookPurchaseStatus.COMPLETED,
        })
            .select('_id')
            .lean()
        return purchase !== null
    }

    async create(data: Partial<IBookPurchase>): Promise<IBookPurchase> {
        await connectDB()
        return BookPurchase.create(data)
    }

    async updateStatus(id: string, status: BookPurchaseStatus): Promise<IBookPurchase | null> {
        await connectDB()
        return BookPurchase.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        ).lean() as Promise<IBookPurchase | null>
    }

    async updateStatusByReference(
        reference: string,
        status: BookPurchaseStatus
    ): Promise<IBookPurchase | null> {
        await connectDB()
        return BookPurchase.findOneAndUpdate(
            { paymentReference: reference },
            { $set: { status } },
            { new: true }
        ).lean() as Promise<IBookPurchase | null>
    }
}

export const bookPurchaseRepository = new BookPurchaseRepository()
