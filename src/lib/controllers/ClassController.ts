import { NextResponse } from "next/server";
import { ClassService } from "@/lib/services/ClassService";
import { UserRole } from "@/models/enums";

export class ClassController {
    static async getClasses(req: Request, userId: string, userRole: UserRole) {
        try {
            // If teacher, get their classes
            if (userRole === UserRole.TEACHER) {
                const classes = await ClassService.getTeacherClasses(userId);
                return NextResponse.json({ success: true, data: classes });
            }

            // If admin/inspector, might want to see all classes or filter by school
            // For now, let's restrict to teacher's classes or return empty for others
            return NextResponse.json({ success: true, data: [] });

        } catch (error: any) {
            console.error("[Class Controller] Get Classes Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async createClass(req: Request, userId: string) {
        try {
            const body = await req.json();
            const { name, school, level, academicYear, field, specialty } = body;

            if (!name || !level || !academicYear) {
                return NextResponse.json(
                    { success: false, message: "Missing required fields: name, level, academicYear" },
                    { status: 400 }
                );
            }

            // Check if teacher has a pending school application
            let pendingSchoolId = null;
            let isIndependent = false;
            
            if (!school) {
                // Teacher is creating an independent class (no school yet)
                const { SchoolService } = await import("@/lib/services/SchoolService");
                const teacherSchools = await SchoolService.getTeacherSchools(userId);
                
                // Find if teacher has any pending school
                const pendingSchool = teacherSchools.find((s: any) => s.isPending);
                if (pendingSchool) {
                    pendingSchoolId = pendingSchool._id;
                }
                
                isIndependent = true;
            }

            const newClass = await ClassService.createClass(
                { 
                    name, 
                    school: school || null, 
                    level, 
                    academicYear, 
                    field, 
                    specialty,
                    isIndependent,
                    pendingSchoolId
                },
                userId
            );

            return NextResponse.json({ success: true, data: newClass }, { status: 201 });

        } catch (error: any) {
            console.error("[Class Controller] Create Class Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async deleteClass(req: Request, classId: string) {
        try {
            await ClassService.deleteClass(classId);
            return NextResponse.json({ success: true, message: "Class deleted successfully" });

        } catch (error: any) {
            console.error("[Class Controller] Delete Class Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getClassById(req: Request, classId: string, userId: string, userRole: UserRole) {
        try {
            const classData = await ClassService.getClassById(classId);

            if (!classData) {
                return NextResponse.json({ success: false, message: "Class not found" }, { status: 404 });
            }

            // Access control: only teacher or admin/inspector
            if (userRole === UserRole.TEACHER && classData.mainTeacher._id.toString() !== userId) {
                return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
            }

            return NextResponse.json({ success: true, data: classData });

        } catch (error: any) {
            console.error("[Class Controller] Get Class By ID Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async updateClass(req: Request, classId: string, userId: string) {
        try {
            const body = await req.json();

            // Check ownership
            const existingClass = await ClassService.getClassById(classId);
            if (!existingClass) {
                return NextResponse.json({ success: false, message: "Class not found" }, { status: 404 });
            }

            if (existingClass.mainTeacher._id.toString() !== userId) {
                return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
            }

            const updatedClass = await ClassService.updateClass(classId, body);
            return NextResponse.json({ success: true, data: updatedClass });

        } catch (error: any) {
            console.error("[Class Controller] Update Class Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async validateOrRejectClass(req: Request, classId: string, userId: string) {
        try {
            const body = await req.json();
            const { action, reason } = body;

            if (!action || !['VALIDATE', 'REJECT'].includes(action)) {
                return NextResponse.json(
                    { success: false, message: "Invalid action. Must be 'VALIDATE' or 'REJECT'" },
                    { status: 400 }
                );
            }

            if (action === 'REJECT' && !reason) {
                return NextResponse.json(
                    { success: false, message: "Rejection reason is required" },
                    { status: 400 }
                );
            }

            // Find class
            const classData = await ClassService.getClassById(classId);
            if (!classData) {
                return NextResponse.json(
                    { success: false, message: "Class not found" },
                    { status: 404 }
                );
            }

            // Verify admin permission (school admin)
            const { SchoolService } = await import("@/lib/services/SchoolService");
            // Check if classData.school is populated and has _id
            const schoolId = classData.school?._id || classData.school;

            // If class has no school, maybe it's orphan? But assuming existing logic.
            if (!schoolId) {
                return NextResponse.json(
                    { success: false, message: "Class is not associated with any school" },
                    { status: 400 }
                );
            }

            const isAuthorized = await SchoolService.verifySchoolAdmin(schoolId.toString(), userId);

            if (!isAuthorized) {
                return NextResponse.json(
                    { success: false, message: "You are not authorized to manage this class" },
                    { status: 403 }
                );
            }

            // Perform action
            let updatedClass;
            if (action === 'VALIDATE') {
                updatedClass = await ClassService.validateClass(classId, userId);
            } else {
                updatedClass = await ClassService.rejectClass(classId, userId, reason);
            }

            return NextResponse.json({
                success: true,
                message: action === 'VALIDATE' ? "Class validated successfully" : "Class rejected",
                data: updatedClass
            });

        } catch (error: any) {
            console.error("[Class Controller] Validate/Reject Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getAdminClasses(req: Request, userId: string) {
        try {
            // Find schools where user is admin
            const { SchoolService } = await import("@/lib/services/SchoolService");
            const adminSchools = await SchoolService.getAdminSchools(userId);

            if (adminSchools.length === 0) {
                return NextResponse.json(
                    { success: false, message: "You are not an administrator of any school" },
                    { status: 403 }
                );
            }

            const { searchParams } = new URL(req.url);
            const { ClassValidationStatus } = await import("@/models/enums");
            const statusFilter = searchParams.get("status");

            // Get classes from all schools this admin manages
            const allClasses = [];
            for (const school of adminSchools) {
                const classes = await ClassService.getSchoolClassesWithValidation(
                    school._id.toString(),
                    statusFilter as any || undefined
                );
                allClasses.push(...classes.map((c: any) => ({
                    ...c,
                    schoolName: school.name
                })));
            }

            return NextResponse.json({
                success: true,
                data: allClasses,
                schools: adminSchools
            });

        } catch (error: any) {
            console.error("[Class Controller] Get Admin Classes Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}

