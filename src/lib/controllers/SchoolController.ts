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
}
