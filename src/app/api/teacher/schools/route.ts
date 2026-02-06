import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";
import { UserRole } from "@/models/enums";
import "@/models/School";
import "@/models/SchoolProfile";
import "@/models/RegulatoryApproval";
import "@/models/SchoolScore";
import "@/models/InfrastructureMetric";
import "@/models/Partner";
import "@/models/City";
import "@/models/Department";
import "@/models/Region";
import "@/models/Country";
import "@/models/User";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== UserRole.TEACHER) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    return SchoolController.getTeacherSchools(session.user.id);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.TEACHER) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    return SchoolController.createSchool(req, session.user.id);
}
