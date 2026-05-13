/**
 * Book.ts — Un livre est un IMedia avec mediaType === BOOK.
 *
 * Pas de modèle Mongoose séparé.
 * Toutes les opérations passent par la collection Media (BookRepository).
 * BookPurchase.bookId et GuestPurchase.bookId référencent désormais Media._id.
 */
import { IMedia } from "./Media";
import { BookFormat, MediaScope, MediaStatus, MediaType } from "./enums";

/**
 * Sous-type d'IMedia représentant un livre.
 */
export interface IBook extends Omit<IMedia, "mediaType"> {
  mediaType: MediaType.BOOK;
  status: MediaStatus;
  scope: MediaScope;
  bookFormat: BookFormat;
  downloadCount: number;
}

export default IBook;
