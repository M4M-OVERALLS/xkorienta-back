import mongoose from 'mongoose'
import connectDB from '../src/lib/mongodb'
import User from '../src/models/User'
import LearnerProfile from '../src/models/LearnerProfile'
import { UserRole } from '../src/models/enums'

/**
 * Migration script for existing learners to initialize school validation flag.
 * 
 * Rules:
 *   - If student has an unverified school => awaitingSchoolValidation: true
 *   - If student has verified school(s) => awaitingSchoolValidation: false
 *   - If student has no school => awaitingSchoolValidation: false (or skip school)
 */
async function migrateAwaitingValidation() {
    try {
        console.log('[Migration] Connecting to database...')
        await connectDB()

        console.log('[Migration] Finding learners without the awaitingSchoolValidation flag...')
        const learners = await LearnerProfile.find({
            awaitingSchoolValidation: { $exists: false }
        }).populate('user')

        console.log(`[Migration] Found ${learners.length} profiles to update.`)

        let updatedCount = 0
        for (const profile of learners) {
            const user: any = profile.user
            if (!user) {
                console.warn(`[Migration] Missing user for profile ${profile._id}, skipping.`)
                continue
            }

            // Determine the flag based on user's current situation
            const hasVerifiedSchool = user.schools && user.schools.length > 0
            const hasUnverifiedSchool = !!user.unverifiedSchool

            // If they have an unverified school, we mark as awaiting validation
            // If they have a verified school, it's definitely NOT awaiting
            // If they have NEITHER, it means they skipped school or it was an old record
            let flagValue = false
            if (hasUnverifiedSchool && !hasVerifiedSchool) {
                flagValue = true
            }

            // Update profile
            await LearnerProfile.updateOne(
                { _id: profile._id },
                { $set: { awaitingSchoolValidation: flagValue } }
            )

            updatedCount++
            if (updatedCount % 50 === 0) {
                console.log(`[Migration] Progress: ${updatedCount}/${learners.length}`)
            }
        }

        console.log(`[Migration] Finished. Updated ${updatedCount} profiles.`)
        process.exit(0)
    } catch (error) {
        console.error('[Migration] Error during migration:', error)
        process.exit(1)
    }
}

// Execute migration
migrateAwaitingValidation()
