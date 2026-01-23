import User, { IUser } from "@/models/User";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class UserRepository {
    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<IUser | null> {
        await connectDB();
        return User.findOne({ email });
    }

    /**
     * Find user by ID
     */
    async findById(userId: string): Promise<IUser | null> {
        await connectDB();
        return User.findById(userId);
    }

    /**
     * Save user document (for updates)
     */
    async save(user: IUser): Promise<IUser> {
        if (user instanceof mongoose.Model || user instanceof mongoose.Document) {
            return user.save();
        }
        throw new Error("Invalid user document for save operation.");
    }

    /**
     * Update user by ID
     */
    async updateById(userId: string, data: Partial<IUser>): Promise<IUser | null> {
        await connectDB();
        return User.findByIdAndUpdate(userId, data, { new: true });
    }
}
