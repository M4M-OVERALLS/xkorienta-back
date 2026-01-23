import { NextResponse } from "next/server";
import { ProfileService } from "@/lib/services/ProfileService";
import { UserRole } from "@/models/enums";

export class ProfileController {
    /**
     * GET /api/profiles/pedagogical
     * Get pedagogical profile
     */
    static async getPedagogicalProfile(userId: string) {
        try {
            const profile = await ProfileService.getPedagogicalProfile(userId);

            if (!profile) {
                return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: profile
            });
        } catch (error: any) {
            console.error("[Profile Controller] Error:", error);
            return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
        }
    }

    /**
     * PUT /api/profiles/pedagogical
     * Update pedagogical profile
     */
    static async updatePedagogicalProfile(req: Request, userId: string) {
        try {
            const data = await req.json();

            // Security: Prevent updating restricted fields
            // Only allow updating: teachingSubjects, interventionLevels, interventionFields, qualifications
            const allowedFields = [
                'teachingSubjects',
                'interventionLevels',
                'interventionFields',
                'qualifications'
            ];

            const updateData: any = {};
            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "No valid fields to update"
                }, { status: 400 });
            }

            const updatedProfile = await ProfileService.updatePedagogicalProfile(userId, updateData);

            if (!updatedProfile) {
                return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: updatedProfile,
                message: "Profile updated successfully"
            });
        } catch (error: any) {
            console.error("[Profile Controller] Update Error:", error);
            return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
        }
    }

    /**
     * GET /api/profiles/stats
     * Get profile statistics based on user role
     */
    static async getProfileStats(userId: string, role: UserRole) {
        try {
            let stats = null;

            if (role === UserRole.STUDENT) {
                stats = await ProfileService.getLearnerStats(userId);
            } else {
                // Use real-time stats for detailed dashboard
                stats = await ProfileService.getRealTimeTeacherStats(userId);
            }

            if (!stats) {
                return NextResponse.json({ message: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error("[Profile Controller] Get Stats Error:", error);
            return NextResponse.json({ message: "Internal server error" }, { status: 500 });
        }
    }

    /**
     * GET /api/profiles/learner
     * Get learner profile
     */
    static async getLearnerProfile(userId: string) {
        try {
            const profile = await ProfileService.getLearnerProfile(userId);

            if (!profile) {
                return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: profile
            });
        } catch (error: any) {
            console.error("[Profile Controller] Get Learner Profile Error:", error);
            return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
        }
    }

    /**
     * PUT /api/profiles/learner
     * Update learner profile
     */
    static async updateLearnerProfile(req: Request, userId: string) {
        try {
            const data = await req.json();

            // Security: Prevent updating restricted fields (like stats, gamification) via this endpoint
            // Only allow updating: currentLevel, currentField, cognitiveProfile, learnerType, preferredLearningMode
            const allowedFields = [
                'currentLevel',
                'currentField',
                'cognitiveProfile',
                'learnerType',
                'preferredLearningMode',
                'enrollmentDate',
                'expectedGraduationDate'
            ];

            const updateData: any = {};
            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "No valid fields to update"
                }, { status: 400 });
            }

            const updatedProfile = await ProfileService.updateLearnerProfile(userId, updateData);

            if (!updatedProfile) {
                return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: updatedProfile,
                message: "Profile updated successfully"
            });
        } catch (error: any) {
            console.error("[Profile Controller] Update Learner Profile Error:", error);
            return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
        }
    }

    /**
     * GET /api/profiles/activities
     * Get recent activities for the current user
     */
    static async getRecentActivities(userId: string, limit?: number) {
        try {
            const activities = await ProfileService.getRecentActivities(userId, limit);

            return NextResponse.json({
                success: true,
                data: activities
            });
        } catch (error: any) {
            console.error("[Profile Controller] Get Recent Activities Error:", error);
            return NextResponse.json({ message: "Internal server error" }, { status: 500 });
        }
    }
}
