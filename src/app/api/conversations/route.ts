import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Conversation, { ConversationType, ConversationStatus } from "@/models/Conversation"
import User from "@/models/User"

/**
 * GET /api/conversations
 * Get all conversations for the current user
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        await connectDB()

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') || 'ACTIVE'
        const limit = parseInt(searchParams.get('limit') || '20')
        const page = parseInt(searchParams.get('page') || '1')

        const conversations = await Conversation.find({
            participants: session.user.id,
            status: status.toUpperCase() as ConversationStatus
        })
            .populate('participants', 'name email image role')
            .populate('lastMessage.senderId', 'name')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()

        const total = await Conversation.countDocuments({
            participants: session.user.id,
            status: status.toUpperCase() as ConversationStatus
        })

        return NextResponse.json({
            success: true,
            data: conversations,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        })

    } catch (error: any) {
        console.error("[Get Conversations] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            )
        }

        await connectDB()

        const { participantIds, type, title, subject } = await req.json()

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return NextResponse.json(
                { success: false, message: "Au moins un participant requis" },
                { status: 400 }
            )
        }

        // Add current user to participants
        const allParticipants = [...new Set([session.user.id, ...participantIds])]

        // For DIRECT conversations, check if one already exists
        if (type === ConversationType.DIRECT && allParticipants.length === 2) {
            const existing = await Conversation.findOne({
                type: ConversationType.DIRECT,
                participants: { $all: allParticipants, $size: 2 }
            }).populate('participants', 'name email image')

            if (existing) {
                return NextResponse.json({
                    success: true,
                    data: existing,
                    message: "Conversation existante"
                })
            }
        }

        // Verify all participants exist
        const users = await User.find({ _id: { $in: allParticipants } })
        if (users.length !== allParticipants.length) {
            return NextResponse.json(
                { success: false, message: "Un ou plusieurs participants introuvables" },
                { status: 404 }
            )
        }

        const conversation = await Conversation.create({
            participants: allParticipants,
            type: type || ConversationType.DIRECT,
            title,
            relatedSubject: subject,
            createdBy: session.user.id,
            status: ConversationStatus.ACTIVE
        })

        const populated = await Conversation.findById(conversation._id)
            .populate('participants', 'name email image role')

        return NextResponse.json({
            success: true,
            data: populated,
            message: "Conversation créée"
        }, { status: 201 })

    } catch (error: any) {
        console.error("[Create Conversation] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
