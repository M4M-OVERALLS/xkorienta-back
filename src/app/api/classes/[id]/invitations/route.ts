import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InvitationController } from "@/lib/controllers/InvitationController";
import connectDB from "@/lib/mongodb";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await context.params;
    await connectDB();

    return InvitationController.getOrCreateLink(id, session.user.id, req.headers);
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { type } = body;

    await connectDB();

    if (type === 'LINK') {
        const { options } = body;
        return InvitationController.createLink(id, session.user.id, options, req.headers);
    }

    if (type === 'INDIVIDUAL') {
        const { email, name } = body;
        return InvitationController.inviteIndividual(id, email, name, session.user.id, req.headers);
    }

    if (type === 'BATCH') {
        const { students, fileInfo } = body;
        return InvitationController.inviteBatch(id, students, session.user.id, fileInfo);
    }

    return NextResponse.json({ error: "Type d'invitation invalide" }, { status: 400 });
}
