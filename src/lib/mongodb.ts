import mongoose from 'mongoose'
import { initEventSystem } from './events'

const MONGODB_URI = process.env.DATABASE_URL

// Only throw error at runtime, not during build
if (!MONGODB_URI && typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    // During build, we allow missing DATABASE_URL by providing a dummy value
    // The real connection will happen at runtime
    console.warn('[MongoDB] DATABASE_URL not set - using placeholder for build')
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null }
}

async function connectDB() {
    // Check DATABASE_URL at runtime
    if (!MONGODB_URI) {
        throw new Error('DATABASE_URL environment variable is not defined')
    }

    // If mongoose is already connected (e.g., in tests), return immediately
    if (mongoose.connection.readyState === 1) {
        return mongoose
    }

    if (cached.conn) {
        return cached.conn
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        }

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose
        })
    }

    try {
        cached.conn = await cached.promise

        // Run index migrations after connection
        try {
            await ensureIndexes()
        } catch (indexError) {
            console.error('[MongoDB] Index migration failed:', indexError)
            // Don't throw - allow DB connection to continue
        }

        // Initialize event system after database connection
        try {
            initEventSystem()
        } catch (eventError) {
            console.error('[MongoDB] Event system initialization failed:', eventError)
            // Don't throw - allow DB connection to continue
        }
    } catch (e) {
        cached.promise = null
        throw e
    }

    return cached.conn
}

/**
 * Ensure indexes are properly configured
 * Fixes the email index to be sparse (allows multiple null values for phone-only users)
 */
async function ensureIndexes() {
    try {
        const db = mongoose.connection.db
        if (!db) {
            console.warn('[MongoDB] Database not available for index migration')
            return
        }

        const usersCollection = db.collection('users')
        const indexes = await usersCollection.indexes()
        
        // Check if email_1 index exists and is not sparse
        const emailIndex = indexes.find(idx => idx.name === 'email_1')
        
        if (emailIndex && !emailIndex.sparse) {
            console.log('[MongoDB] Migrating email index to sparse...')
            await usersCollection.dropIndex('email_1')
            await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true })
            console.log('[MongoDB] ✓ Email index migrated to sparse')
        } else if (!emailIndex) {
            // Create sparse index if it doesn't exist
            console.log('[MongoDB] Creating sparse email index...')
            await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true })
            console.log('[MongoDB] ✓ Sparse email index created')
        }
    } catch (error) {
        console.error('[MongoDB] Index migration error:', error)
        throw error
    }
}

export default connectDB
