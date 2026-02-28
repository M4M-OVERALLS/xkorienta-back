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
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Check existing indexes
        console.log('\n=== Current indexes ===');
        const indexes = await usersCollection.indexes();
        indexes.forEach(idx => {
            console.log(`- ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
        });

        // Drop the old email_1 index if it exists and is not sparse
        const emailIndex = indexes.find(idx => idx.name === 'email_1');
        if (emailIndex && !emailIndex.sparse) {
            console.log('\n=== Dropping old non-sparse email_1 index ===');
            await usersCollection.dropIndex('email_1');
            console.log('✓ Dropped email_1 index');
        } else if (emailIndex && emailIndex.sparse) {
            console.log('\n✓ email_1 index is already sparse, no action needed');
        } else {
            console.log('\n⚠ email_1 index not found');
        }

        // Create the new sparse index
        console.log('\n=== Creating sparse email index ===');
        await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('✓ Created sparse unique index on email');

        // Verify
        console.log('\n=== Updated indexes ===');
        const newIndexes = await usersCollection.indexes();
        newIndexes.forEach(idx => {
            console.log(`- ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
        });

        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

fixEmailIndex();
