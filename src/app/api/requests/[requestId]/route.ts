import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { RequestController } from '@/lib/controllers/RequestController';

interface RouteParams {
    params: Promise<{ requestId: string }>;
}

/**
 * GET /api/requests/[requestId]
 * Get request details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const { requestId } = await params;
    return RequestController.getRequestById(requestId, session.user.id);
}

/**
 * PUT /api/requests/[requestId]
 * Update request (accept/reject/complete)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const { requestId } = await params;
    return RequestController.updateRequest(request, requestId, session.user.id);
}

/**
 * DELETE /api/requests/[requestId]
 * Cancel a request (student only, if pending)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const { requestId } = await params;
    return RequestController.cancelRequest(requestId, session.user.id);
}
