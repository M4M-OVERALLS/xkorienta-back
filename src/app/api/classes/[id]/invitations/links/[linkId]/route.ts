import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InvitationService } from "@/lib/services/InvitationService";
import connectDB from "@/lib/mongodb";

/**
 * DELETE /api/classes/[id]/invitations/links/[linkId]
 * Revoke an invitation link
 */
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string; linkId: string }> }
) {
    try {
        const { id, linkId } = await props.params;
        await connectDB();
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        await InvitationService.revokeInvitation(linkId, session.user.id);

        return NextResponse.json({ success: true, message: "Lien révoqué" });

    } catch (error: any) {
        console.error("Error revoking invitation:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Erreur serveur"
        }, { status: 500 });
    }
}
