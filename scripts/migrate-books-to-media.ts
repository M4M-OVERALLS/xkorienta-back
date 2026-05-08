/**
 * Migration : Copie tous les documents de la collection "books" vers "media"
 * avec mediaType="BOOK".
 *
 * Les _id sont préservés → BookPurchase.bookId et GuestPurchase.bookId
 * continuent de fonctionner sans modification.
 *
 * Usage : npx tsx scripts/migrate-books-to-media.ts
 *
 * Idempotent : les livres déjà migrés (même _id dans media) sont ignorés.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/lib/mongodb'

const BOOK_MIME: Record<string, string> = {
    PDF:  'application/pdf',
    EPUB: 'application/epub+zip',
}

async function migrate() {
    await connectDB()
    const db = mongoose.connection.db

    if (!db) {
        console.error('[Migration] Connexion MongoDB non disponible')
        process.exit(1)
    }

    const books = db.collection('books')
    const media = db.collection('media')

    const allBooks = await books.find({}).toArray()
    console.log(`[Migration] ${allBooks.length} livre(s) trouvé(s) dans "books"`)

    let inserted = 0
    let skipped  = 0

    for (const book of allBooks) {
        const exists = await media.findOne({ _id: book._id })
        if (exists) {
            skipped++
            continue
        }

        const mimeType = BOOK_MIME[book.format as string] ?? 'application/pdf'

        await media.insertOne({
            ...book,
            mediaType:     'BOOK',
            bookFormat:    book.format,
            mimeType,
            fileSize:      book.fileSize ?? 0,
            playCount:     0,
            downloadCount: book.downloadCount ?? 0,
            // Nettoyer le champ "format" de Book qui n'existe pas dans Media
            format: undefined,
        })

        inserted++
    }

    console.log(`[Migration] ${inserted} livre(s) migré(s), ${skipped} ignoré(s) (déjà présent(s))`)

    if (inserted > 0) {
        // Re-créer les index de recommandation pour les nouveaux docs BOOK
        await media.createIndex({ mediaType: 1, status: 1, scope: 1 }, { background: true })
        console.log('[Migration] Index "media" mis à jour.')
    }

    await mongoose.disconnect()
    console.log('[Migration] Terminé.')
    process.exit(0)
}

migrate().catch((err) => {
    console.error('[Migration] Erreur fatale :', err)
    process.exit(1)
})
