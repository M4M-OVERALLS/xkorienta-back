/**
 * Migration script to fix the email index
 * Drops the old non-sparse email_1 index and recreates it as sparse
 * This allows multiple users with email: null (phone-only users)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qcmapp';

async function fixEmailIndex() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Check existing indexes
        const indexes = await usersCollection.indexes();
        indexes.forEach(idx => {
        });

        // Drop the old email_1 index if it exists and is not sparse
        const emailIndex = indexes.find(idx => idx.name === 'email_1');
        if (emailIndex && !emailIndex.sparse) {
            await usersCollection.dropIndex('email_1');
        } else if (emailIndex && emailIndex.sparse) {
        } else {
        }

        // Create the new sparse index
        await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });

        // Verify
        const newIndexes = await usersCollection.indexes();
        newIndexes.forEach(idx => {
        });
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

fixEmailIndex();
