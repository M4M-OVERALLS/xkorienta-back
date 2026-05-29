/**
 * One-time sync script: aligns school.teachers[] ↔ user.schools[]
 *
 * Run: npx tsx scripts/sync-school-teachers.ts
 *
 * For each school:
 *   1. Users with school in user.schools but NOT in school.teachers → add to school.teachers
 *   2. Users in school.teachers but school NOT in user.schools → add to user.schools
 *   3. mainTeachers of school classes who are in neither → add to both
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.DATABASE_URL || ''

async function main() {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

    const School = mongoose.connection.collection('schools')
    const User = mongoose.connection.collection('users')
    const Class = mongoose.connection.collection('classes')

    const schools = await School.find({}).toArray()
    let totalFixed = 0

    for (const school of schools) {
        const schoolId = school._id.toString()
        const schoolTeacherIds = new Set((school.teachers || []).map((id: any) => id.toString()))

        // 1. Find users who have this school in their profile but aren't in school.teachers
        const usersWithSchool = await User.find({ schools: school._id }).toArray()
        for (const user of usersWithSchool) {
            const uid = user._id.toString()
            if (!schoolTeacherIds.has(uid)) {
                await School.updateOne({ _id: school._id }, { $addToSet: { teachers: user._id } })
                schoolTeacherIds.add(uid)
                console.log(`  + Added ${user.name} (${user.email}) to school.teachers of "${school.name}"`)
                totalFixed++
            }
        }

        // 2. Find school.teachers who don't have the school in user.schools
        for (const teacherId of school.teachers || []) {
            const user = await User.findOne({ _id: teacherId })
            if (!user) continue
            const userSchools = (user.schools || []).map((id: any) => id.toString())
            if (!userSchools.includes(schoolId)) {
                await User.updateOne({ _id: teacherId }, { $addToSet: { schools: school._id } })
                console.log(`  + Added school "${school.name}" to user.schools of ${user.name} (${user.email})`)
                totalFixed++
            }
        }

        // 3. mainTeachers of school classes who are missing from both
        const classes = await Class.find({ school: school._id, mainTeacher: { $ne: null } }).toArray()
        for (const cls of classes) {
            if (!cls.mainTeacher) continue
            const tid = cls.mainTeacher.toString()
            if (!schoolTeacherIds.has(tid)) {
                await School.updateOne({ _id: school._id }, { $addToSet: { teachers: cls.mainTeacher } })
                await User.updateOne({ _id: cls.mainTeacher }, { $addToSet: { schools: school._id } })
                console.log(`  + Synced mainTeacher of class "${cls.name}" into school "${school.name}"`)
                totalFixed++
            }
        }
    }

    console.log(`\nDone. ${totalFixed} fix(es) applied.`)
    await mongoose.disconnect()
}

main().catch((err) => { console.error(err); process.exit(1) })
