import { NextResponse } from "next/server";
import { InvitationService } from "@/lib/services/InvitationService";

const MAX_BATCH_SIZE = 500;

export class InvitationController {
    static async getOrCreateLink(classId: string, userId: string) {
        try {
            const invitation = await InvitationService.getOrCreateLink(classId, userId);

            const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${invitation.token}`;

            return NextResponse.json({
                invitation,
                url: inviteUrl
            });
        } catch (error: any) {
            console.error("[Invitation Controller] Get/Create Link Error:", error);
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }
    }

    static async createLink(classId: string, userId: string, options?: any) {
        try {
            const invitation = await InvitationService.getOrCreateLink(classId, userId, options);
            const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${invitation.token}`;

            return NextResponse.json({ invitation, url: inviteUrl });
        } catch (error: any) {
            console.error("[Invitation Controller] Create Link Error:", error);
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }
    }

    static async inviteIndividual(classId: string, email: string, name: string, userId: string) {
        try {
            if (!email || !name) {
                return NextResponse.json({ error: "Email et nom requis" }, { status: 400 });
            }

            const result = await InvitationService.inviteStudent(classId, email, name, userId);
            return NextResponse.json(result);
        } catch (error: any) {
            console.error("[Invitation Controller] Invite Individual Error:", error);
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }
    }

    static async inviteBatch(classId: string, students: any[], userId: string, fileInfo?: any) {
        try {
            if (!students || !Array.isArray(students)) {
                return NextResponse.json({ error: "Liste d'étudiants requise" }, { status: 400 });
            }

            // Security: Limit batch size
            if (students.length > MAX_BATCH_SIZE) {
                return NextResponse.json({
                    error: `Trop d'étudiants. Maximum: ${MAX_BATCH_SIZE}`
                }, { status: 400 });
            }

            // Security: Basic server-side validation of each student
            const sanitizedStudents = students
                .filter((s: any) => s && typeof s.name === 'string' && typeof s.email === 'string')
                .map((s: any) => ({
                    name: String(s.name).trim().substring(0, 100),
                    email: String(s.email).trim().toLowerCase().substring(0, 254)
                }))
                .filter((s: any) => s.name.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email));

            const result = await InvitationService.processBatch(classId, sanitizedStudents, userId, fileInfo);
            return NextResponse.json(result);
        } catch (error: any) {
            console.error("[Invitation Controller] Batch Invite Error:", error);
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }
    }

    /**
     * GET /api/schools/[id]/invitations
     * Get or create an invitation link for a school
     */
    static async getOrCreateSchoolLink(schoolId: string, userId: string) {
        try {
            // Validate ID
            if (!schoolId || schoolId === 'undefined') {
                return NextResponse.json({ error: "Invalid school ID" }, { status: 400 });
            }

            const link = await InvitationService.getOrCreateSchoolLink(schoolId, userId);
            // Retourner un chemin relatif - le client construira l'URL complète
            return NextResponse.json({ link: `/api/invitations/${link.token}/join` });
        } catch (error: any) {
            console.error("[Invitation Controller] Get/Create School Link Error:", error);
            return NextResponse.json({ error: "Internal Error" }, { status: 500 });
        }
    }

    /**
     * POST /api/schools/[id]/invitations
     * Invite teachers to a school (individual or batch)
     */
    static async inviteTeachersToSchool(schoolId: string, type: string, email: string, name: string, teachers: any[], userId: string) {
        try {
            // Validate ID
            if (!schoolId || schoolId === 'undefined') {
                return NextResponse.json({ error: "Invalid school ID" }, { status: 400 });
            }

            if (type === 'INDIVIDUAL') {
                if (!email || !name) {
                    return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
                }

                const result = await InvitationService.inviteTeacher(schoolId, email, name, userId);
                return NextResponse.json(result);
            }

            if (type === 'BATCH') {
                if (!teachers || !Array.isArray(teachers)) {
                    return NextResponse.json({ error: "Teachers list is required" }, { status: 400 });
                }

                // Security: Limit batch size
                if (teachers.length > MAX_BATCH_SIZE) {
                    return NextResponse.json({
                        error: `Too many teachers. Maximum: ${MAX_BATCH_SIZE}`
                    }, { status: 400 });
                }

                // Security: Basic server-side validation of each teacher
                const sanitizedTeachers = teachers
                    .filter((t: any) => t && typeof t.name === 'string' && typeof t.email === 'string')
                    .map((t: any) => ({
                        name: String(t.name).trim().substring(0, 100),
                        email: String(t.email).trim().toLowerCase().substring(0, 254)
                    }))
                    .filter((t: any) => t.name.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email));

                const result = await InvitationService.processTeacherBatch(schoolId, sanitizedTeachers, userId);
                return NextResponse.json(result);
            }

            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        } catch (error: any) {
            console.error("[Invitation Controller] Invite Teachers to School Error:", error);
            return NextResponse.json({ error: "Internal Error" }, { status: 500 });
        }
    }

    /**
     * GET /api/invitations/[token]/join
     * Accept an invitation and redirect to appropriate page
     */
    static async acceptInvitationAndRedirect(req: Request, token: string, userId: string) {
        try {
            if (!token) {
                const errorUrl = `/dashboard?error=${encodeURIComponent("Token d'invitation manquant")}`;
                return NextResponse.redirect(new URL(errorUrl, req.url));
            }

            const result = await InvitationService.acceptInvitation(token, userId);

            // Determine redirect URL based on resource type
            if (result.classId) {
                const classUrl = `/student/classes/${result.classId}`;
                return NextResponse.redirect(new URL(classUrl, req.url));
            } else if (result.schoolId) {
                const schoolUrl = `/teacher/schools/${result.schoolId}`;
                return NextResponse.redirect(new URL(schoolUrl, req.url));
            }

            // Default redirect to dashboard
            return NextResponse.redirect(new URL('/dashboard', req.url));
        } catch (error: any) {
            console.error("[Invitation Controller] Accept Invitation Error:", error);
            const errorUrl = `/dashboard?error=${encodeURIComponent(error.message || "Erreur lors de l'acceptation de l'invitation")}`;
            return NextResponse.redirect(new URL(errorUrl, req.url));
        }
    }
}
