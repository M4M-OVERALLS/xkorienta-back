import Invitation, { IInvitation } from "@/models/Invitation";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class InvitationRepository {
    /**
     * Find invitation by token with populated relations
     */
    async findByToken(token: string): Promise<IInvitation | null> {
        await connectDB();
        return Invitation.findOne({ token, status: 'PENDING' })
            .populate({
                path: 'classId',
                populate: { path: 'mainTeacher', select: 'name email' }
            });
    }

    /**
     * Find invitation by token (basic, no populate)
     */
    async findByTokenBasic(token: string): Promise<IInvitation | null> {
        await connectDB();
        return Invitation.findOne({ token })
            .populate({
                path: 'classId',
                select: 'name academicYear',
                populate: [
                    { path: 'school', select: 'name' },
                    { path: 'mainTeacher', select: 'name email' }
                ]
            });
    }

    /**
     * Save invitation document (for updates)
     */
    async save(invitation: IInvitation): Promise<IInvitation> {
        if (invitation instanceof mongoose.Model || invitation instanceof mongoose.Document) {
            return invitation.save();
        }
        throw new Error("Invalid invitation document for save operation.");
    }

    /**
     * Create invitation
     */
    async create(data: Partial<IInvitation>): Promise<IInvitation> {
        await connectDB();
        return Invitation.create(data);
    }

    /**
     * Find invitation by classId, type and status
     */
    async findByClassIdTypeAndStatus(
        classId: string,
        type: string,
        status: string
    ): Promise<IInvitation | null> {
        await connectDB();
        return Invitation.findOne({
            classId,
            type,
            status,
            $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
        });
    }
}
