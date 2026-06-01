import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ClassController } from "@/lib/controllers/ClassController";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Validate ID
    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, message: "Invalid class ID" }, { status: 400 });
    }

    await connectDB();
    return ClassController.getClassById(req, id, session.user.id, session.user.role as UserRole);
}

export async function PUT(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.TEACHER) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Validate ID
    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, message: "Invalid class ID" }, { status: 400 });
    }

    await connectDB();
    return ClassController.updateClass(req, id, session.user.id);
}

const ADMIN_ROLES: string[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT, UserRole.SCHOOL_ADMIN];

export async function DELETE(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    const isAdmin = ADMIN_ROLES.includes(role);

    // Non-admins must be TEACHER role
    if (!isAdmin && role !== UserRole.TEACHER) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ success: false, message: "Invalid class ID" }, { status: 400 });
    }

    await connectDB();

    const existingClass = await import('@/lib/services/ClassService').then(m => m.ClassService.getClassById(id));
    if (!existingClass) {
        return NextResponse.json({ success: false, message: "Class not found" }, { status: 404 });
    }

    // Admins can delete any class; teachers only their own
    if (!isAdmin && existingClass.mainTeacher?._id?.toString() !== session.user.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    return ClassController.deleteClass(req, id);
}
