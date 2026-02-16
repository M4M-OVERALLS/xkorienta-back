import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Request from '@/models/Request';

interface RouteParams {
    params: Promise<{ requestId: string }>;
}

/**
 * GET /api/requests/[requestId]/messages
 * Get all messages for a request
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const { requestId } = await params;

    try {
        const req = await Request.findById(requestId)
            .select('messages studentId teacherId')
            .lean();

        if (!req) {
            return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
        }

        // Access check: only student or assigned teacher can view
        const studentId = req.studentId?.toString();
        const teacherId = req.teacherId?.toString();
        const userId = session.user.id;

        if (userId !== studentId && userId !== teacherId) {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            data: req.messages || []
        });
    } catch (error: any) {
        console.error('[Messages Route] GET Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/requests/[requestId]/messages
 * Send a message in a request conversation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const { requestId } = await params;

    try {
        const body = await request.json();
        const { content } = body;

        if (!content || !content.trim()) {
            return NextResponse.json({ error: 'Le message ne peut pas être vide' }, { status: 400 });
        }

        const req = await Request.findById(requestId);
        if (!req) {
            return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
        }

        // Access check: only student or assigned teacher can send messages
        const studentId = req.studentId?.toString();
        const teacherId = req.teacherId?.toString();
        const userId = session.user.id;

        if (userId !== studentId && userId !== teacherId) {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        // Determine sender role
        const senderRole = userId === studentId ? 'student' : 'teacher';

        // Create message
        const newMessage = {
            sender: userId,
            senderName: session.user.name || 'Utilisateur',
            senderRole,
            content: content.trim(),
            sentAt: new Date()
        };

        // Initialize messages array if it doesn't exist
        if (!req.messages) {
            req.messages = [];
        }

        req.messages.push(newMessage as any);

        // If the request is still PENDING or ACCEPTED, mark as IN_PROGRESS / ACCEPTED
        // to indicate active conversation
        if (req.status === 'PENDING' && senderRole === 'teacher') {
            req.status = 'ACCEPTED' as any;
            req.respondedAt = new Date();
        }

        await req.save();

        // Return the saved message (last one in array)
        const savedMessage = req.messages[req.messages.length - 1];

        return NextResponse.json({
            success: true,
            data: savedMessage
        }, { status: 201 });
    } catch (error: any) {
        console.error('[Messages Route] POST Error:', error);
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
    }
}
