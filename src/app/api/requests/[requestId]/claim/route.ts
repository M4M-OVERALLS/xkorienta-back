import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/models/enums';
import { RequestController } from '@/lib/controllers/RequestController';

/**
 * POST /api/requests/[requestId]/claim
 * Claim an external request (teacher only)
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ requestId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.TEACHER) {
        return NextResponse.json({ error: 'Seuls les enseignants peuvent prendre des demandes' }, { status: 403 });
    }

    const { requestId } = await params;
    return RequestController.claimRequest(requestId, session.user.id);
}
