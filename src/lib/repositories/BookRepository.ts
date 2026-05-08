import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Media from "@/models/Media";
import { IBook } from "@/models/Book";
import { MediaStatus, MediaScope, MediaType } from "@/models/enums";

export interface BookFilters {
  scope?: MediaScope;
  schoolId?: string;
  status?: MediaStatus;
  /** Format du livre : PDF ou EPUB */
  format?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  page?: number;
  limit?: number;
  /** Liste catalogue : projection légère (sans description / fileKey) */
  catalogPreview?: boolean;
}

export interface PaginatedBooks {
  books: IBook[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Filtre de base commun à toutes les requêtes : restreint à la collection Media */
const BOOK_BASE = { mediaType: MediaType.BOOK } as const;

export class BookRepository {
  async findById(id: string): Promise<IBook | null> {
    await connectDB();
    return Media.findOne({ _id: id, ...BOOK_BASE })
      .populate("submittedBy", "name email image paymentInfo")
      .populate("validatedBy", "name")
      .lean() as Promise<IBook | null>;
  }

  async findPaginated(filters: BookFilters): Promise<PaginatedBooks> {
    await connectDB();

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { ...BOOK_BASE };

    if (filters.status) query.status = filters.status;
    if (filters.scope) query.scope = filters.scope;
    if (filters.format) query.bookFormat = filters.format;

    if (filters.schoolId) {
      query.schoolId = new mongoose.Types.ObjectId(filters.schoolId);
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined)
        (query.price as Record<string, number>).$gte = filters.minPrice;
      if (filters.maxPrice !== undefined)
        (query.price as Record<string, number>).$lte = filters.maxPrice;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const listQuery = Media.find(query)
      .populate("submittedBy", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (filters.catalogPreview) {
      listQuery.select(
        "_id mediaType bookFormat title price currency downloadCount purchaseCount coverImageKey submittedBy createdAt",
      );
    }

    const [books, total] = await Promise.all([
      listQuery.lean(),
      Media.countDocuments(query),
    ]);

    return {
      books: books as IBook[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTeacher(
    teacherId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedBooks> {
    await connectDB();
    const skip = (page - 1) * limit;

    const query = {
      ...BOOK_BASE,
      submittedBy: new mongoose.Types.ObjectId(teacherId),
    };

    const [books, total] = await Promise.all([
      Media.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Media.countDocuments(query),
    ]);

    return {
      books: books as IBook[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPending(scope?: MediaScope, schoolId?: string): Promise<IBook[]> {
    await connectDB();

    const query: Record<string, unknown> = {
      ...BOOK_BASE,
      status: MediaStatus.PENDING,
    };
    if (scope) query.scope = scope;
    if (schoolId) query.schoolId = new mongoose.Types.ObjectId(schoolId);

    return Media.find(query)
      .populate("submittedBy", "name email image")
      .sort({ createdAt: 1 })
      .lean() as Promise<IBook[]>;
  }

  async create(data: Partial<IBook>): Promise<IBook> {
    await connectDB();
    const doc = await Media.create({ ...data, mediaType: MediaType.BOOK });
    return doc as unknown as IBook;
  }

  async updateById(id: string, data: Partial<IBook>): Promise<IBook | null> {
    await connectDB();
    return Media.findOneAndUpdate(
      { _id: id, ...BOOK_BASE },
      { $set: data },
      { new: true },
    ).lean() as Promise<IBook | null>;
  }

  async deleteById(id: string): Promise<void> {
    await connectDB();
    await Media.findOneAndDelete({ _id: id, ...BOOK_BASE });
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await connectDB();
    await Media.findOneAndUpdate(
      { _id: id, ...BOOK_BASE },
      { $inc: { downloadCount: 1 } },
    );
  }

  async incrementPurchaseCount(id: string): Promise<void> {
    await connectDB();
    await Media.findOneAndUpdate(
      { _id: id, ...BOOK_BASE },
      { $inc: { purchaseCount: 1 } },
    );
  }
}

export const bookRepository = new BookRepository();
