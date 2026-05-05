#!/usr/bin/env node

/**
 * Migration script: BookPurchase -> Transaction
 * 
 * This script migrates existing BookPurchase records to the new Transaction model.
 * It preserves all data and creates proper references.
 * 
 * Usage:
 *   node scripts/migrate-book-purchases.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without writing to database
 */

require('dotenv').config()
const mongoose = require('mongoose')

// Import enums
const TransactionType = {
    BOOK_PURCHASE: 'BOOK_PURCHASE',
    SUBSCRIPTION: 'SUBSCRIPTION',
    COURSE: 'COURSE',
    TOP_UP: 'TOP_UP'
}

const TransactionStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    EXPIRED: 'EXPIRED'
}

const BookPurchaseStatus = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
}

// Map BookPurchaseStatus to TransactionStatus
const STATUS_MAP = {
    [BookPurchaseStatus.PENDING]: TransactionStatus.PENDING,
    [BookPurchaseStatus.COMPLETED]: TransactionStatus.COMPLETED,
    [BookPurchaseStatus.FAILED]: TransactionStatus.FAILED,
    [BookPurchaseStatus.REFUNDED]: TransactionStatus.REFUNDED
}

async function connectDB() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        throw new Error('MONGODB_URI not defined in environment')
    }
    await mongoose.connect(uri)
}

async function migrate(dryRun = false) {
    const db = mongoose.connection.db

    // Get collections
    const bookPurchases = db.collection('bookpurchases')
    const transactions = db.collection('transactions')
    const books = db.collection('books')

    // Count existing records
    const totalPurchases = await bookPurchases.countDocuments()
    const existingMigrated = await transactions.countDocuments({ type: TransactionType.BOOK_PURCHASE })


    // Get all book purchases not yet migrated
    const existingRefs = await transactions.distinct('paymentReference', { type: TransactionType.BOOK_PURCHASE })
    const toMigrate = await bookPurchases.find({
        paymentReference: { $nin: existingRefs }
    }).toArray()


    if (toMigrate.length === 0) {
        return
    }

    if (dryRun) {
    }

    let migrated = 0
    let failed = 0

    for (const purchase of toMigrate) {
        try {
            // Get book details for seller ID
            const book = await books.findOne({ _id: purchase.bookId })
            const sellerId = book?.submittedBy || null

            const transaction = {
                userId: purchase.userId,
                type: TransactionType.BOOK_PURCHASE,
                productId: purchase.bookId,
                productModel: 'Book',

                // Amounts
                originalAmount: purchase.originalPrice,
                originalCurrency: purchase.currency,
                convertedAmount: purchase.finalAmount,
                paymentCurrency: purchase.currency,
                exchangeRate: 1,
                discountPercent: purchase.discountPercent,
                finalAmount: purchase.finalAmount,

                // Commissions
                platformCommission: purchase.platformCommission,
                sellerAmount: purchase.teacherAmount,
                sellerId: sellerId,

                // Payment
                paymentReference: purchase.paymentReference,
                paymentProvider: purchase.paymentProvider,

                status: STATUS_MAP[purchase.status] || TransactionStatus.PENDING,
                statusHistory: [{
                    status: STATUS_MAP[purchase.status] || TransactionStatus.PENDING,
                    at: purchase.createdAt,
                    reason: 'Migrated from BookPurchase'
                }],

                // Metadata
                metadata: {
                    migratedFrom: 'BookPurchase',
                    originalId: purchase._id.toString(),
                    migratedAt: new Date().toISOString()
                },
                completedAt: purchase.status === BookPurchaseStatus.COMPLETED ? purchase.updatedAt : null,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now

                createdAt: purchase.createdAt,
                updatedAt: purchase.updatedAt
            }

            if (!dryRun) {
                await transactions.insertOne(transaction)
            }

            migrated++
            
            if (migrated % 100 === 0) {
            }
        } catch (err) {
            failed++
        }
    }

}

async function main() {
    const dryRun = process.argv.includes('--dry-run')


    try {
        await connectDB()
        await migrate(dryRun)
    } catch (err) {
        process.exit(1)
    } finally {
        await mongoose.disconnect()
    }
}

main()
