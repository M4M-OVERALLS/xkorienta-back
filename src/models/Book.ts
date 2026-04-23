import mongoose, { Document, Model, Schema } from "mongoose";
import { BookFormat, BookScope, BookStatus } from "./enums";

export interface IBook extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  format: BookFormat;
  fileKey: string;
  coverImageKey?: string;
  price: number;
  currency: string;
  scope: BookScope;
  schoolId?: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  status: BookStatus;
  validatedBy?: mongoose.Types.ObjectId;
  validationComment?: string;
  validatedAt?: Date;
  copyrightAccepted: boolean;
  downloadCount: number;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    format: {
      type: String,
      enum: Object.values(BookFormat),
      required: true,
    },
    fileKey: {
      type: String,
      required: true,
    },
    coverImageKey: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "XAF",
      trim: true,
      uppercase: true,
    },
    scope: {
      type: String,
      enum: Object.values(BookScope),
      required: true,
      default: BookScope.GLOBAL,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BookStatus),
      default: BookStatus.PENDING,
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    validationComment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    validatedAt: {
      type: Date,
    },
    copyrightAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

BookSchema.index({ status: 1, scope: 1 });
/** Catalogue public : filtre status+scope + tri createdAt */
BookSchema.index({ status: 1, scope: 1, createdAt: -1 });
BookSchema.index({ submittedBy: 1 });
BookSchema.index({ schoolId: 1, status: 1 });
BookSchema.index({ price: 1, status: 1 });
BookSchema.index({ title: "text", description: "text" });

const Book: Model<IBook> =
  mongoose.models.Book || mongoose.model<IBook>("Book", BookSchema);
export default Book;
