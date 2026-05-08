/**
 * Book.ts — Un livre est un IMedia avec mediaType === BOOK.
 *
 * Pas de modèle Mongoose séparé.
 * Toutes les opérations passent par la collection Media (BookRepository).
 * BookPurchase.bookId et GuestPurchase.bookId référencent désormais Media._id.
 */
import { IMedia } from "./Media";
import { BookFormat, BookScope, BookStatus, MediaType } from "./enums";

/**
 * Sous-type d'IMedia représentant un livre.
 * status et scope utilisent les types Book (mêmes valeurs string que Media).
 */
export interface IBook extends Omit<IMedia, "status" | "scope"> {
  mediaType: MediaType.BOOK;
  status: BookStatus;
  scope: BookScope;
  bookFormat: BookFormat;
  downloadCount: number;
}

export default IBook;
