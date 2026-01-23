import { NextResponse } from "next/server";
import { SyllabusService } from "@/lib/services/SyllabusService";

export class SyllabusController {
    /**
     * GET /api/syllabuses
     * List syllabuses with filtering
     */
    static async getSyllabuses(req: Request, userId?: string) {
        try {
            const { searchParams } = new URL(req.url);
            const subject = searchParams.get('subject') || undefined;
            const school = searchParams.get('school') || undefined;

            const syllabuses = await SyllabusService.listSyllabuses({
                teacherId: userId,
                subject,
                school
            });

            return NextResponse.json({ success: true, data: syllabuses });
        } catch (error: any) {
            console.error("[Syllabus Controller] Get Syllabuses Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    /**
     * POST /api/syllabuses
     * Create a new syllabus using the Builder pattern
     */
    static async createSyllabus(req: Request, userId: string) {
        try {
            const data = await req.json();

            // Validate required fields
            if (!data.title || !data.subject) {
                return NextResponse.json(
                    { success: false, message: "Title and Subject are required" },
                    { status: 400 }
                );
            }

            const syllabus = await SyllabusService.createSyllabus(data, userId);

            return NextResponse.json({ success: true, data: syllabus }, { status: 201 });
        } catch (error: any) {
            console.error("[Syllabus Controller] Create Syllabus Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    /**
     * POST /api/syllabus/[id]/clone
     * Clone a syllabus for the current user
     */
    static async cloneSyllabus(req: Request, syllabusId: string, userId: string) {
        try {
            const clonedSyllabus = await SyllabusService.cloneSyllabus(syllabusId, userId);
            return NextResponse.json({ success: true, data: clonedSyllabus }, { status: 201 });
        } catch (error: any) {
            console.error("[Syllabus Controller] Clone Syllabus Error:", error);

            if (error.message === "Original syllabus not found") {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 404 }
                );
            }
            if (error.message === "Invalid syllabus ID") {
                return NextResponse.json(
                    { success: false, message: error.message },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getById(req: Request, id: string, userId: string) {
        try {
            // userId passed for potential future ACL checks, though service handles logic.
            const syllabus = await SyllabusService.getSyllabusById(id);
            return NextResponse.json({ success: true, data: syllabus });
        } catch (error: any) {
            console.error("[Syllabus Controller] Get Error:", error);

            if (error.message === "Syllabus not found") {
                return NextResponse.json({ success: false, message: error.message }, { status: 404 });
            }
            if (error.message === "Invalid syllabus ID") {
                return NextResponse.json({ success: false, message: error.message }, { status: 400 });
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async update(req: Request, id: string, userId: string) {
        try {
            const body = await req.json();
            const updatedSyllabus = await SyllabusService.updateSyllabus(id, userId, body);

            return NextResponse.json({ success: true, data: updatedSyllabus });
        } catch (error: any) {
            console.error("[Syllabus Controller] Update Error:", error);

            if (error.message === "Syllabus not found") {
                return NextResponse.json({ success: false, message: error.message }, { status: 404 });
            }
            if (error.message === "Forbidden") {
                return NextResponse.json({ success: false, message: error.message }, { status: 403 });
            }
            if (error.message === "Invalid syllabus ID") {
                return NextResponse.json({ success: false, message: error.message }, { status: 400 });
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async delete(req: Request, id: string, userId: string) {
        try {
            await SyllabusService.deleteSyllabus(id, userId);

            return NextResponse.json({ success: true, message: "Syllabus archived" });
        } catch (error: any) {
            console.error("[Syllabus Controller] Delete Error:", error);

            if (error.message === "Syllabus not found") {
                return NextResponse.json({ success: false, message: error.message }, { status: 404 });
            }
            if (error.message === "Forbidden") {
                return NextResponse.json({ success: false, message: error.message }, { status: 403 });
            }
            if (error.message === "Invalid syllabus ID") {
                return NextResponse.json({ success: false, message: error.message }, { status: 400 });
            }

            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
