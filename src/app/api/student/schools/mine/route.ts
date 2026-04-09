import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import School from "@/models/School";

/**
 * GET /api/student/schools/mine
 * Returns the schools the student is linked to (direct link OR applicant).
 * Used to determine whether to show the "link your school" banner.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Non autorisé" },
                { status: 401 }
            );
        }

        await connectDB();

        const userId = session.user.id;

        // Schools directly linked on the user document
        const user = await User.findById(userId)
            .select("schools")
            .populate("schools", "name city")
            .lean() as { schools?: Array<{ _id: unknown; name: string; city?: string }> } | null;

        const directSchools: Array<{ _id: string; name: string; city?: string }> =
            (user?.schools ?? []).map((s) => ({
                _id: s._id?.toString() ?? "",
                name: s.name,
                city: s.city,
            }));

        // Schools where the student is listed as an applicant
        const applicantSchools = await School.find({ applicants: userId })
            .select("_id name city")
            .lean() as Array<{ _id: unknown; name: string; city?: string }>;

        const applicantMapped = applicantSchools.map((s) => ({
            _id: s._id?.toString() ?? "",
            name: s.name,
            city: s.city,
        }));

        // Merge and deduplicate by _id
        const merged = [...directSchools];
        for (const s of applicantMapped) {
            if (!merged.some((m) => m._id === s._id)) {
                merged.push(s);
            }
        }

        return NextResponse.json({ success: true, data: merged });
    } catch (error) {
        console.error("[Student Schools Mine] Error:", error);
        return NextResponse.json(
            { success: false, message: "Erreur interne" },
            { status: 500 }
        );
    }
}
