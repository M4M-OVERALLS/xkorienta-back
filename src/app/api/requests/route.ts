import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { UserRole } from '@/models/enums';
import { RequestController } from '@/lib/controllers/RequestController';

/**
 * GET /api/requests
 * List requests for current user (student or teacher)
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const userId = session.user.id;
    const role = session.user.role as UserRole;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;

    return RequestController.getRequests(userId, role, status, type);
}

/**
 * POST /api/requests
 * Create a new assistance request (student only)
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.STUDENT) {
        return NextResponse.json({ error: 'Seuls les étudiants peuvent créer des demandes' }, { status: 403 });
    }

    await connectDB();
    return RequestController.createRequest(request, session.user.id);
}
