import { NextResponse } from "next/server";
import { SchoolService } from "@/lib/services/SchoolService";

export class SchoolController {
    static async getSchools(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const search = searchParams.get('search') || undefined;
            const type = searchParams.get('type') || undefined;

            const schools = await SchoolService.searchSchools(search, type);
            return NextResponse.json({ success: true, data: schools });
        } catch (error: any) {
            console.error("[Schools Controller] Error:", error);
            return NextResponse.json(
                { success: false, message: "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getSchoolClasses(req: Request, schoolId: string) {
        try {
            // Basic validation
            if (!schoolId || schoolId === 'undefined') {
                return NextResponse.json({ success: false, message: "Invalid school ID" }, { status: 400 });
            }

            const classes = await SchoolService.getSchoolClasses(schoolId);
            return NextResponse.json({ success: true, data: classes }); // Wrap in success format for consistency
        } catch (error: any) {
            console.error("[Schools Controller] Get Classes Error:", error);
            return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
        }
    }

    static async getTeacherSchools(teacherId: string) {
        try {
            const schools = await SchoolService.getTeacherSchools(teacherId);
            return NextResponse.json({ success: true, data: schools });
        } catch (error: any) {
            console.error("[School Controller] Get Teacher Schools Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async validateSchool(req: Request, schoolId: string, adminId: string) {
        try {
            const body = await req.json();
            const { status } = body;

            // Optional: Role check could be here if not in Route
            // But usually Route handles Auth/Role basics

            await SchoolService.validateSchool(schoolId, adminId, status);

            return NextResponse.json({ success: true, message: "School status updated" });

        } catch (error: any) {
            console.error("[School Controller] Validation Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    /**
     * POST /api/schools/apply
     * Apply to a school
     */
    static async applyToSchool(req: Request, userId: string) {
        try {
            if (!userId) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }

            const body = await req.json();
            const { schoolId } = body;

            if (!schoolId) {
                return NextResponse.json(
                    { error: "School ID is required" },
                    { status: 400 }
                );
            }

            const result = await SchoolService.applyToSchool(schoolId, userId);

            return NextResponse.json(result);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[School Controller] Apply to School Error:", error);
            
            // Handle specific error cases
            if (errorMessage === "School not found") {
                return NextResponse.json(
                    { error: errorMessage },
                    { status: 404 }
                );
            }
            
            if (errorMessage.includes("already") || errorMessage.includes("member")) {
                return NextResponse.json(
                    { error: errorMessage },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/schools/[id]/teachers
     * Get all teachers for a school
     */
    static async getSchoolTeachers(schoolId: string) {
        try {
            // Validate ID
            if (!schoolId || schoolId === 'undefined') {
                return NextResponse.json(
                    { error: "Invalid school ID" },
                    { status: 400 }
                );
            }

            const teachers = await SchoolService.getSchoolTeachers(schoolId);
            return NextResponse.json(teachers);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Internal server error";
            console.error("[School Controller] Get School Teachers Error:", error);
            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }
    }

    /**
     * GET /api/schools/[id]/stats
     * Get statistics for a school
     */
    static async getSchoolStats(schoolId: string) {
        try {
            // Validate ID
            if (!schoolId || schoolId === 'undefined') {
                return NextResponse.json(
                    { error: "Invalid school ID" },
                    { status: 400 }
                );
            }

            const stats = await SchoolService.getSchoolStats(schoolId);
            if (!stats) {
                return NextResponse.json(
                    { error: "School not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json(stats);
        } catch (error: unknown) {
            console.error("[School Controller] Get School Stats Error:", error);
            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }
    }
}
