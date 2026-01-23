import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { InvitationController } from "@/lib/controllers/InvitationController";

interface RouteParams {
    params: Promise<{ token: string }>;
}

/**
 * GET /api/invitations/[token]/join
 * Accept an invitation and redirect to appropriate page
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { token } = await params;
    await connectDB();

    const session = await getServerSession(authOptions);

    // If not logged in, redirect to login with callback
    // The callback will be THIS url, so after login, user comes back here
    if (!session?.user) {
        const callbackUrl = encodeURIComponent(req.url);
        const loginUrl = `/login?callbackUrl=${callbackUrl}`;
        return NextResponse.redirect(new URL(loginUrl, req.url));
    }

    // If logged in, accept invitation via controller
    return InvitationController.acceptInvitationAndRedirect(req, token, session.user.id);
}
