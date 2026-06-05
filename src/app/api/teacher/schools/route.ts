import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";
import { UserRole } from "@/models/enums";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    const role = session?.user?.role
    if (!session?.user?.id || (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN)) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    return SchoolController.getTeacherSchools(session.user.id);
}
