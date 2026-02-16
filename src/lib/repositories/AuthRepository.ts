import connectDB from "@/lib/mongodb";
import User, { IUser } from "@/models/User";
import mongoose from "mongoose";

export class AuthRepository {
    async findByEmailWithPassword(email: string) {
        await connectDB();
        return await User.findOne({ email }).select("+password");
    }

    async incrementLoginAttempts(userId: string, lockUntil?: Date) {
        await connectDB();
        const update: any = { $inc: { loginAttempts: 1 } };
        if (lockUntil) {
            update.$set = { lockedUntil: lockUntil };
        }
        await User.findByIdAndUpdate(userId, update);
    }

    async resetLoginAttempts(userId: string) {
        await connectDB();
        await User.findByIdAndUpdate(userId, {
            $set: {
                loginAttempts: 0,
                lockedUntil: null,
                lastLogin: new Date()
            }
        });
    }

    async saveResetToken(userId: string, hashedToken: string, expires: Date) {
        await connectDB();
        // Use native MongoDB driver to bypass any Mongoose schema caching issues
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        await db.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $set: {
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: expires
                }
            }
        );
        console.log(`[AuthRepo] Reset token saved for user ${userId}`);
    }

    async findByResetToken(hashedToken: string) {
        await connectDB();
        // Use native MongoDB driver to bypass Mongoose select: false caching
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        const user = await db.collection('users').findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() }
        });

        console.log(`[AuthRepo] findByResetToken result:`, user ? `Found user ${user.email}` : 'No user found');
        return user;
    }

    async clearResetToken(userId: string) {
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        await db.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $unset: {
                    resetPasswordToken: 1,
                    resetPasswordExpires: 1
                }
            }
        );
    }

    async updatePassword(userId: string, hashedPassword: string) {
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        await db.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $set: { password: hashedPassword },
                $unset: {
                    resetPasswordToken: 1,
                    resetPasswordExpires: 1
                }
            }
        );
    }
}
